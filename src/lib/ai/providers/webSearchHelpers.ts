import type { ChatRole, ContentPart } from "../types";

export const OPENAI_WEB_SEARCH_TOOL = { type: "web_search" } as const;
export const ANTHROPIC_WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 5,
} as const;
export const OPENROUTER_WEB_SEARCH_TOOL = {
  type: "openrouter:web_search",
} as const;

function contentToString(content: string | ContentPart[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

/** Split system vs conversational messages for OpenAI Responses API. */
export function toOpenAIResponsesPayload(
  messages: { role: ChatRole; content: string | ContentPart[] }[],
): {
  instructions: string | undefined;
  input: { role: "user" | "assistant"; content: string | ContentPart[] }[];
} {
  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) => contentToString(m.content))
    .filter(Boolean);

  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as
        | "user"
        | "assistant",
      content: m.content,
    }));

  return {
    instructions: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    input,
  };
}

export function extractOpenAIResponsesDelta(payload: string): string {
  try {
    const json = JSON.parse(payload);
    if (json.type === "response.output_text.delta") {
      return json.delta ?? "";
    }
  } catch {
    /* ignore malformed SSE chunks */
  }
  return "";
}
