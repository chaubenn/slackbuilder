export type ChatRole = "system" | "user" | "assistant";

// Multi-modal content parts (for vision requests)
export interface ContentPartText {
  type: "text";
  text: string;
}

export interface ContentPartImage {
  type: "image";
  mimeType: string;
  data: string; // base64-encoded bytes, no data-URL prefix
}

export type ContentPart = ContentPartText | ContentPartImage;

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  pendingEditCount?: number;
  imageCount?: number; // display-only: how many images were attached when sent
}

export type AiProviderId = "openai" | "anthropic" | "openrouter";

export interface AiProviderSettings {
  provider: AiProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface StreamOpts {
  signal?: AbortSignal;
  onToken?: (token: string) => void;
}

export interface AiProvider {
  id: AiProviderId;
  defaultModel: string;
  streamChat(
    messages: { role: ChatRole; content: string | ContentPart[] }[],
    opts: StreamOpts,
  ): Promise<string>;
}

export const PROVIDERS: Record<
  AiProviderId,
  { label: string; defaultModel: string; defaultBaseUrl: string }
> = {
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  anthropic: {
    label: "Anthropic",
    defaultModel: "claude-sonnet-4-6",
    defaultBaseUrl: "https://api.anthropic.com/v1",
  },
  openrouter: {
    label: "OpenRouter",
    defaultModel: "anthropic/claude-3.5-sonnet",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
  },
};
