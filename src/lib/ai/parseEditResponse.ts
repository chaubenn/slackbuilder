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
      assistantMessage: raw.trim() || "(no response)",
      edits: [],
    };
  }

  let parsed: RawResponse;
  try {
    parsed = JSON.parse(block);
  } catch {
    return {
      assistantMessage:
        stripJsonBlock(raw).trim() ||
        "(could not parse structured response)",
      edits: [],
    };
  }

  const edits: StructuredEdit[] = (parsed.edits ?? [])
    .map((e) => normalizeEdit(e))
    .filter((e): e is StructuredEdit => e !== null);

  const assistantMessage =
    parsed.assistantMessage?.trim() ||
    stripJsonBlock(raw).trim() ||
    `Proposed ${edits.length} edit${edits.length === 1 ? "" : "s"}.`;

  return {
    assistantMessage,
    edits,
    optionalFullRewrite: parsed.optionalFullRewrite,
  };
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

function extractJsonBlock(text: string): string | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();

  const anyFenced = text.match(/```\s*([\s\S]*?)```/);
  if (anyFenced) {
    const candidate = anyFenced[1].trim();
    if (candidate.startsWith("{")) return candidate;
  }

  const start = text.indexOf("{");
  if (start === -1) return null;
  const end = text.lastIndexOf("}");
  if (end <= start) return null;
  return text.slice(start, end + 1);
}

function stripJsonBlock(text: string): string {
  return text.replace(/```json\s*[\s\S]*?```/gi, "").replace(/```[\s\S]*?```/g, "");
}
