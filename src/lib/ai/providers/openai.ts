import type {
  AiProvider,
  AiProviderSettings,
  ChatRole,
  ContentPart,
  StreamOpts,
} from "../types";
import { formatProviderHttpError } from "../formatApiError";
import { getActiveApiKey, PROVIDERS } from "../types";
import {
  ANTHROPIC_WEB_SEARCH_TOOL,
  extractOpenAIResponsesDelta,
  OPENAI_WEB_SEARCH_TOOL,
  OPENROUTER_WEB_SEARCH_TOOL,
  toOpenAIResponsesPayload,
} from "./webSearchHelpers";

// ---------------------------------------------------------------------------
// OpenAI-compatible content serialiser
// ---------------------------------------------------------------------------
function toOpenAIContent(content: string | ContentPart[]) {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "text") {
      return { type: "text", text: part.text };
    }
    return {
      type: "image_url",
      image_url: { url: `data:${part.mimeType};base64,${part.data}` },
    };
  });
}

// ---------------------------------------------------------------------------
// Anthropic content serialiser (different schema)
// ---------------------------------------------------------------------------
function toAnthropicContent(content: string | ContentPart[]) {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "text") {
      return { type: "text", text: part.text };
    }
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: part.mimeType as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp",
        data: part.data,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true for OpenAI reasoning models that have restricted API options
 * (no system messages, different temperature handling, etc.).
 */
function isReasoningModel(model: string): boolean {
  return /^o[134](-mini|-preview)?$/i.test(model.trim());
}

/**
 * Returns true for models that support `response_format: { type: "json_object" }`.
 * Reasoning models (o1-preview, o1-mini) from early 2024 don't support it.
 * Newer o-series (o3, o4-mini, o1-2024-12-17+) do support structured output,
 * but we use a conservative check: only disable it for known problematic models.
 */
function supportsJsonResponseFormat(model: string): boolean {
  const lower = model.toLowerCase().trim();
  // Early o1 preview models don't support response_format
  if (lower === "o1-preview" || lower === "o1-mini") return false;
  return true;
}

function toResponsesContent(content: string | ContentPart[]) {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "text") {
      return { type: "input_text", text: part.text };
    }
    return {
      type: "input_image",
      image_url: `data:${part.mimeType};base64,${part.data}`,
    };
  });
}

async function streamOpenAIResponses(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: { role: ChatRole; content: string | ContentPart[] }[],
  opts: StreamOpts,
): Promise<string> {
  const { instructions, input } = toOpenAIResponsesPayload(messages);

  // Web search and JSON mode are mutually exclusive on the Responses API.
  // Structured edits still come from the system prompt; parseAiResponse extracts JSON.
  const body: Record<string, unknown> = {
    model,
    input: input.map((m) => ({
      role: m.role,
      content: toResponsesContent(m.content),
    })),
    tools: [OPENAI_WEB_SEARCH_TOOL],
    stream: true,
    ...(instructions ? { instructions } : {}),
  };

  const res = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(
      formatProviderHttpError("OpenAI", res.status, text || res.statusText),
    );
  }

  return readSseStream(res.body, opts.onToken, extractOpenAIResponsesDelta);
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------
export function createOpenAIProvider(settings: AiProviderSettings): AiProvider {
  const baseUrl = (
    settings.baseUrl?.trim() || PROVIDERS.openai.defaultBaseUrl
  ).replace(/\/$/, "");

  const model = settings.model || PROVIDERS.openai.defaultModel;

  return {
    id: "openai",
    defaultModel: PROVIDERS.openai.defaultModel,
    async streamChat(messages, opts: StreamOpts) {
      if (opts.webSearch) {
        return streamOpenAIResponses(
          baseUrl,
          settings.apiKey,
          model,
          messages,
          opts,
        );
      }

      // Reasoning models (o1-mini, o1-preview) don't support system role —
      // convert system messages to user messages with a [SYSTEM] prefix.
      const processedMessages = isReasoningModel(model)
        ? messages.map((m) =>
            m.role === "system"
              ? { role: "user" as const, content: `[SYSTEM]\n${m.content}` }
              : m,
          )
        : messages;

      const body: Record<string, unknown> = {
        model,
        messages: processedMessages.map((m) => ({
          role: m.role,
          content: toOpenAIContent(m.content),
        })),
        stream: true,
        temperature: isReasoningModel(model) ? undefined : 0.4,
        // Force valid JSON output so the model can't respond with bare prose.
        // extractJsonBlock() handles both fenced (```json{…}```) and raw ({…}) JSON.
        ...(supportsJsonResponseFormat(model) && !opts.askMode
          ? { response_format: { type: "json_object" } }
          : {}),
      };

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(
          formatProviderHttpError("OpenAI", res.status, text || res.statusText),
        );
      }

      return readSseStream(res.body, opts.onToken, (line) => {
        try {
          const json = JSON.parse(line);
          return json.choices?.[0]?.delta?.content ?? "";
        } catch {
          return "";
        }
      });
    },
  };
}

export function createOpenRouterProvider(
  settings: AiProviderSettings,
): AiProvider {
  const baseUrl = (
    settings.baseUrl?.trim() || PROVIDERS.openrouter.defaultBaseUrl
  ).replace(/\/$/, "");

  const model = settings.model || PROVIDERS.openrouter.defaultModel;

  return {
    id: "openrouter",
    defaultModel: PROVIDERS.openrouter.defaultModel,
    async streamChat(messages, opts: StreamOpts) {
      // OpenRouter: only add response_format for OpenAI-compatible models.
      // Non-OpenAI models may not support it — we skip it to be safe.
      const isOpenAIModel =
        model.startsWith("openai/") ||
        model.startsWith("gpt-") ||
        model.startsWith("o1") ||
        model.startsWith("o3") ||
        model.startsWith("o4");

      const body: Record<string, unknown> = {
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: toOpenAIContent(m.content),
        })),
        stream: true,
        temperature: 0.4,
        ...(isOpenAIModel && !opts.webSearch && !opts.askMode
          ? { response_format: { type: "json_object" } }
          : {}),
        ...(opts.webSearch ? { tools: [OPENROUTER_WEB_SEARCH_TOOL] } : {}),
      };

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
          "HTTP-Referer": "https://slackbuilder.local",
          "X-Title": "Slackbuilder",
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(
          formatProviderHttpError(
            "OpenRouter",
            res.status,
            text || res.statusText,
          ),
        );
      }

      return readSseStream(res.body, opts.onToken, (line) => {
        try {
          const json = JSON.parse(line);
          return json.choices?.[0]?.delta?.content ?? "";
        } catch {
          return "";
        }
      });
    },
  };
}

// Anthropic uses a different streaming shape; it emits SSE events of various types.
export function createAnthropicProvider(
  settings: AiProviderSettings,
): AiProvider {
  const baseUrl = (
    settings.baseUrl?.trim() || PROVIDERS.anthropic.defaultBaseUrl
  ).replace(/\/$/, "");

  return {
    id: "anthropic",
    defaultModel: PROVIDERS.anthropic.defaultModel,
    async streamChat(messages, opts: StreamOpts) {
      // Anthropic separates system messages from conversational messages
      const systemMessages = messages
        .filter((m) => m.role === "system")
        .map((m) => (typeof m.content === "string" ? m.content : ""))
        .join("\n\n");

      const conversational = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: toAnthropicContent(m.content),
        }));

      const body: Record<string, unknown> = {
        model: settings.model || PROVIDERS.anthropic.defaultModel,
        max_tokens: 4096,
        system: systemMessages || undefined,
        messages: conversational,
        stream: true,
        ...(opts.webSearch ? { tools: [ANTHROPIC_WEB_SEARCH_TOOL] } : {}),
      };

      const res = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(
          formatProviderHttpError(
            "Anthropic",
            res.status,
            text || res.statusText,
          ),
        );
      }

      return readSseStream(res.body, opts.onToken, (line) => {
        try {
          const json = JSON.parse(line);
          if (
            json.type === "content_block_delta" &&
            json.delta?.type === "text_delta"
          ) {
            return json.delta.text ?? "";
          }
          return "";
        } catch {
          return "";
        }
      });
    },
  };
}

// ---------------------------------------------------------------------------
// SSE stream reader
// ---------------------------------------------------------------------------
async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onToken: ((t: string) => void) | undefined,
  extract: (data: string) => string,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const rawLine = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!rawLine.startsWith("data:")) continue;
      const payload = rawLine.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      const token = extract(payload);
      if (token) {
        full += token;
        onToken?.(token);
      }
    }
  }

  return full;
}

export function buildProvider(settings: AiProviderSettings): AiProvider {
  const withKey = { ...settings, apiKey: getActiveApiKey(settings) };
  switch (settings.provider) {
    case "openai":
      return createOpenAIProvider(withKey);
    case "anthropic":
      return createAnthropicProvider(withKey);
    case "openrouter":
      return createOpenRouterProvider(withKey);
    default:
      return createOpenAIProvider(withKey);
  }
}

export const _role = (r: ChatRole) => r;
