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
  theme?: "light" | "dark";
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

// ---------------------------------------------------------------------------
// Model capability definitions
// ---------------------------------------------------------------------------
export interface ModelCapabilities {
  vision: boolean;     // Accepts image inputs
  reasoning: boolean;  // Extended thinking / chain-of-thought reasoning model
  webSearch: boolean;  // Has built-in web search tool
}

/** Known-model capability table. Falls back to heuristics for unknown models. */
const KNOWN: Record<string, ModelCapabilities> = {
  // OpenAI
  "gpt-4o":              { vision: true,  reasoning: false, webSearch: false },
  "gpt-4o-mini":         { vision: true,  reasoning: false, webSearch: false },
  "gpt-4-turbo":         { vision: true,  reasoning: false, webSearch: false },
  "gpt-4.1":             { vision: true,  reasoning: false, webSearch: false },
  "gpt-4.1-mini":        { vision: true,  reasoning: false, webSearch: false },
  "gpt-4.1-nano":        { vision: true,  reasoning: false, webSearch: false },
  "o1":                  { vision: true,  reasoning: true,  webSearch: false },
  "o1-mini":             { vision: false, reasoning: true,  webSearch: false },
  "o1-preview":          { vision: false, reasoning: true,  webSearch: false },
  "o3":                  { vision: true,  reasoning: true,  webSearch: false },
  "o3-mini":             { vision: false, reasoning: true,  webSearch: false },
  "o4-mini":             { vision: true,  reasoning: true,  webSearch: false },
  // Anthropic
  "claude-opus-4-7":              { vision: true, reasoning: true,  webSearch: false },
  "claude-sonnet-4-6":            { vision: true, reasoning: false, webSearch: false },
  "claude-haiku-4-5-20251001":    { vision: true, reasoning: false, webSearch: false },
  "claude-3-5-sonnet-20241022":   { vision: true, reasoning: false, webSearch: false },
  "claude-3-5-haiku-20241022":    { vision: true, reasoning: false, webSearch: false },
  "claude-3-opus-20240229":       { vision: true, reasoning: false, webSearch: false },
  // OpenRouter common
  "anthropic/claude-3.5-sonnet":  { vision: true, reasoning: false, webSearch: false },
  "openai/gpt-4o":                { vision: true, reasoning: false, webSearch: false },
  "openai/gpt-4o-mini":           { vision: true, reasoning: false, webSearch: false },
  "openai/o3-mini":               { vision: false, reasoning: true,  webSearch: false },
  "openai/o4-mini":               { vision: true,  reasoning: true,  webSearch: false },
  "meta-llama/llama-3.1-70b-instruct": { vision: false, reasoning: false, webSearch: false },
  "google/gemini-2.0-flash-001":  { vision: true, reasoning: false, webSearch: false },
  "google/gemini-2.5-pro":        { vision: true, reasoning: true,  webSearch: false },
};

export function getModelCapabilities(model: string): ModelCapabilities {
  const m = model.trim();
  if (KNOWN[m]) return KNOWN[m];

  // Heuristic fallback
  const lower = m.toLowerCase();
  const noVision = /o1-mini|o1-preview|o3-mini/.test(lower);
  const vision =
    !noVision &&
    (lower.includes("gpt-4") ||
      lower.includes("claude") ||
      lower.includes("4o") ||
      lower.includes("gemini") ||
      /\bo[34]-?\d/.test(lower) ||
      lower.includes("vision"));
  const reasoning =
    lower.startsWith("o1") ||
    lower.startsWith("o3") ||
    lower.startsWith("o4") ||
    lower.includes("/o1") ||
    lower.includes("/o3") ||
    lower.includes("/o4") ||
    lower.includes("thinking") ||
    lower.includes("reason");

  return { vision, reasoning, webSearch: false };
}

/** Quick-pick model lists shown in the model selector dropdown */
export const PROVIDER_MODEL_PRESETS: Record<
  AiProviderId,
  { id: string; label: string }[]
> = {
  openai: [
    { id: "gpt-4o-mini",  label: "GPT-4o mini" },
    { id: "gpt-4o",       label: "GPT-4o" },
    { id: "gpt-4.1",      label: "GPT-4.1" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { id: "o3-mini",      label: "o3-mini" },
    { id: "o4-mini",      label: "o4-mini" },
  ],
  anthropic: [
    { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
    { id: "claude-sonnet-4-6",         label: "Sonnet 4.6" },
    { id: "claude-opus-4-7",           label: "Opus 4.7" },
  ],
  openrouter: [
    { id: "anthropic/claude-3.5-sonnet",       label: "Claude 3.5 Sonnet" },
    { id: "openai/gpt-4o",                     label: "GPT-4o" },
    { id: "openai/gpt-4o-mini",                label: "GPT-4o mini" },
    { id: "openai/o4-mini",                    label: "o4-mini" },
    { id: "google/gemini-2.5-pro",             label: "Gemini 2.5 Pro" },
    { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
  ],
};
