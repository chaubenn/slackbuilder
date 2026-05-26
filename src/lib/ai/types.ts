export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  pendingEditCount?: number;
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
    messages: { role: ChatRole; content: string }[],
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
    defaultModel: "claude-3-5-sonnet-latest",
    defaultBaseUrl: "https://api.anthropic.com/v1",
  },
  openrouter: {
    label: "OpenRouter",
    defaultModel: "anthropic/claude-3.5-sonnet",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
  },
};
