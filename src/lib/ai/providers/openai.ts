import type {
  AiProvider,
  AiProviderSettings,
  ChatRole,
  ContentPart,
  StreamOpts,
} from "../types";
import { PROVIDERS } from "../types";

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
// Providers
// ---------------------------------------------------------------------------
export function createOpenAIProvider(settings: AiProviderSettings): AiProvider {
  const baseUrl = (
    settings.baseUrl?.trim() || PROVIDERS.openai.defaultBaseUrl
  ).replace(/\/$/, "");

  return {
    id: "openai",
    defaultModel: PROVIDERS.openai.defaultModel,
    async streamChat(messages, opts: StreamOpts) {
      const body = {
        model: settings.model || PROVIDERS.openai.defaultModel,
        messages: messages.map((m) => ({
          role: m.role,
          content: toOpenAIContent(m.content),
        })),
        stream: true,
        temperature: 0.4,
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
        throw new Error(`OpenAI error ${res.status}: ${text || res.statusText}`);
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

  return {
    id: "openrouter",
    defaultModel: PROVIDERS.openrouter.defaultModel,
    async streamChat(messages, opts: StreamOpts) {
      const body = {
        model: settings.model || PROVIDERS.openrouter.defaultModel,
        messages: messages.map((m) => ({
          role: m.role,
          content: toOpenAIContent(m.content),
        })),
        stream: true,
        temperature: 0.4,
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
          `OpenRouter error ${res.status}: ${text || res.statusText}`,
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

      const body = {
        model: settings.model || PROVIDERS.anthropic.defaultModel,
        max_tokens: 4096,
        system: systemMessages || undefined,
        messages: conversational,
        stream: true,
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
          `Anthropic error ${res.status}: ${text || res.statusText}`,
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
  switch (settings.provider) {
    case "openai":
      return createOpenAIProvider(settings);
    case "anthropic":
      return createAnthropicProvider(settings);
    case "openrouter":
      return createOpenRouterProvider(settings);
    default:
      return createOpenAIProvider(settings);
  }
}

export const _role = (r: ChatRole) => r;
