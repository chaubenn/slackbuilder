function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function readMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

/** Pull a human-readable message from common provider error JSON shapes. */
export function extractApiErrorDetail(
  parsed: unknown,
  fallback = "",
): string | null {
  if (!parsed || typeof parsed !== "object") {
    return fallback.trim() || null;
  }

  const root = parsed as Record<string, unknown>;

  const nestedError = root.error;
  if (nestedError && typeof nestedError === "object") {
    const err = nestedError as Record<string, unknown>;
    const nestedMessage = readMessage(err.message);
    if (nestedMessage) return nestedMessage;
  }

  const topLevelMessage = readMessage(root.message);
  if (topLevelMessage) return topLevelMessage;

  return fallback.trim() || null;
}

function isAuthError(status: number, parsed: unknown, detail: string | null): boolean {
  if (status === 401 || status === 403) return true;

  if (!parsed || typeof parsed !== "object") {
    return /invalid.*api.?key|authentication/i.test(detail ?? "");
  }

  const root = parsed as Record<string, unknown>;
  const nested = root.error;
  if (nested && typeof nested === "object") {
    const err = nested as Record<string, unknown>;
    if (err.type === "authentication_error") return true;
    if (err.code === "invalid_api_key") return true;
  }

  return /invalid.*api.?key|authentication/i.test(detail ?? "");
}

export function formatProviderHttpError(
  provider: string,
  status: number,
  body: string,
): string {
  const parsed = tryParseJson(body);
  const detail = extractApiErrorDetail(parsed, body);

  if (isAuthError(status, parsed, detail)) {
    return `Invalid API key for ${provider}. Check your key in Settings.`;
  }

  if (detail) {
    return `${provider} error (${status}): ${detail}`;
  }

  return `${provider} error (${status})`;
}

/** Normalize thrown provider errors (and legacy raw JSON blobs) for chat display. */
export function formatApiErrorMessage(raw: string): string {
  const match = raw.match(
    /^(OpenAI|Anthropic|OpenRouter) error (\d+): ([\s\S]*)$/,
  );
  if (match) {
    const [, provider, status, body] = match;
    return formatProviderHttpError(provider, Number(status), body.trim());
  }
  return raw;
}

export function formatChatError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return formatApiErrorMessage(raw);
}
