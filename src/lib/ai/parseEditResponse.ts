import { nanoid } from "nanoid";
import type { AiEditResponse, StructuredEdit } from "../slack/types";

interface RawEdit {
  id?: string;
  type?: string;
  target?: unknown;
  content?: string;
  rationale?: string;
}

interface RawResponse {
  assistantMessage?: string;
  edits?: RawEdit[];
  optionalFullRewrite?: string;
}

export function parseAiResponse(raw: string): AiEditResponse {
  const block = extractJsonBlock(raw);
  if (!block) {
    return {
      assistantMessage: humanizeFallback(raw) || "(no response)",
      edits: [],
    };
  }

  let parsed: RawResponse;
  try {
    parsed = JSON.parse(block);
  } catch {
    return {
      assistantMessage:
        humanizeFallback(stripJsonBlock(raw)) ||
        "(could not parse structured response)",
      edits: [],
    };
  }

  const rawEdits = Array.isArray(parsed.edits) ? parsed.edits : [];

  // Determine the full-rewrite content: prefer explicit optionalFullRewrite,
  // otherwise promote the content of any rewrite_section edit that has no
  // usable target.
  let fullRewrite =
    typeof parsed.optionalFullRewrite === "string" &&
    parsed.optionalFullRewrite.trim().length > 0
      ? parsed.optionalFullRewrite
      : undefined;
  if (fullRewrite === undefined) {
    for (const e of rawEdits) {
      if (
        e &&
        e.type === "rewrite_section" &&
        typeof e.content === "string" &&
        e.content.trim().length > 0 &&
        !isUsableTarget(e.target)
      ) {
        fullRewrite = e.content;
        break;
      }
    }
  }

  const edits: StructuredEdit[] = rawEdits
    .map((e) => normalizeEdit(e))
    .filter((e): e is StructuredEdit => e !== null);

  // If the model only supplied a full rewrite (no edits with usable targets),
  // synthesise a single full-rewrite pending edit so the UI can offer Accept.
  if (edits.length === 0 && fullRewrite !== undefined) {
    edits.push({
      id: `edit-${nanoid(6)}`,
      type: "rewrite_section",
      target: { start: 0, end: 0 },
      content: fullRewrite,
      rationale: "Replace the entire message with the proposed rewrite.",
    });
  }

  const assistantMessage =
    parsed.assistantMessage?.trim() ||
    humanizeFallback(stripJsonBlock(raw)) ||
    `Proposed ${edits.length} edit${edits.length === 1 ? "" : "s"}.`;

  return {
    assistantMessage,
    edits,
    optionalFullRewrite: fullRewrite,
  };
}

function isUsableTarget(target: unknown): boolean {
  if (typeof target === "string") return /^(text|image|link)-/.test(target);
  if (target && typeof target === "object") {
    const t = target as { start?: unknown; end?: unknown };
    return typeof t.start === "number" && typeof t.end === "number";
  }
  return false;
}

// When the model returns raw text instead of JSON, it sometimes embeds literal
// "\n" / "\t" / "\\" / "\"" two-character sequences. If the text contains no
// real newlines but does contain those escape patterns, treat it as if it were
// a JSON string body and unescape it for display.
function humanizeFallback(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  const hasRealNewline = text.includes("\n");
  const hasEscapedNewline = /\\n/.test(text);
  if (hasRealNewline || !hasEscapedNewline) return text;
  return text
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

function normalizeEdit(e: RawEdit): StructuredEdit | null {
  if (!e || typeof e !== "object") return null;
  const type = e.type;
  if (
    type !== "replace" &&
    type !== "insert" &&
    type !== "delete" &&
    type !== "rewrite_section"
  ) {
    return null;
  }

  let target: StructuredEdit["target"];
  if (typeof e.target === "string") {
    if (!/^(text|image|link)-/.test(e.target)) return null;
    target = e.target;
  } else if (
    e.target &&
    typeof e.target === "object" &&
    typeof (e.target as { start?: number }).start === "number" &&
    typeof (e.target as { end?: number }).end === "number"
  ) {
    const t = e.target as { start: number; end: number };
    target = { start: t.start, end: t.end };
  } else {
    return null;
  }

  return {
    id: e.id || `edit-${nanoid(6)}`,
    type,
    target,
    content: typeof e.content === "string" ? e.content : undefined,
    rationale: typeof e.rationale === "string" ? e.rationale : undefined,
  };
}

// Find a balanced JSON object in `text`, ignoring unrelated text and any
// triple-backtick fences. Walks the JSON tracking string state and escape
// characters so triple-backticks inside string values do not confuse us.
function extractJsonBlock(text: string): string | null {
  const fenceMatch = /```json\s*/i.exec(text);
  const searchFrom =
    fenceMatch && fenceMatch.index !== undefined
      ? fenceMatch.index + fenceMatch[0].length
      : 0;

  const start = text.indexOf("{", searchFrom);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function stripJsonBlock(text: string): string {
  const block = extractJsonBlock(text);
  let stripped = text;
  if (block) stripped = stripped.replace(block, "");
  return stripped.replace(/```json/gi, "").replace(/```/g, "").trim();
}
