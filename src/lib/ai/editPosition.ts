import type { StructuredEdit } from "../slack/types";

const MOVE_INTENT =
  /\b(move|relocate|reorder|reposition|put\b[^.]{0,40}\bto the (top|bottom))\b/i;

const APPEND_INTENT =
  /\b(at |to |into )?(the )?(very )?(bottom|end)\b|\bappend( to| at)?\b|\badd\b[^.]{0,80}\b(at |to )(the )?(bottom|end)\b|\bbelow\b[^.]{0,40}\b(message|rest|everything)\b|\bafter (the )?(rest|everything|message)\b/i;

export function wantsAppendToMessage(text: string): boolean {
  const t = text.trim();
  if (MOVE_INTENT.test(t)) return false;
  return APPEND_INTENT.test(t);
}

function ensureSeparatorBeforeAppend(mrkdwn: string, content: string): string {
  const body = content ?? "";
  if (!mrkdwn.trim() || !body.trim()) return body;
  if (/^\n/.test(body)) return body;
  return mrkdwn.endsWith("\n") ? `\n${body}` : `\n\n${body}`;
}

function isOffsetTarget(
  target: StructuredEdit["target"],
): target is { start: number; end: number } {
  return (
    typeof target === "object" &&
    target !== null &&
    typeof target.start === "number" &&
    typeof target.end === "number"
  );
}

/** Rewrites mis-placed inserts/replaces when the user asked to append at the message end. */
export function normalizeEditPositions(
  mrkdwn: string,
  edits: StructuredEdit[],
  hints: { userMessage?: string } = {},
): StructuredEdit[] {
  const len = mrkdwn.length;
  const appendIntent =
    wantsAppendToMessage(hints.userMessage ?? "") ||
    edits.some((e) => wantsAppendToMessage(e.rationale ?? ""));

  if (!appendIntent || len === 0) return edits;

  const endTarget = { start: len, end: len };

  return edits.map((edit) => {
    const content = edit.content;
    if (!content && edit.type !== "delete") return edit;

    if (edit.type === "move") return edit;

    const shouldAppend =
      edit.type === "insert" ||
      edit.type === "replace" ||
      edit.type === "rewrite_section";

    if (!shouldAppend) return edit;

    const offset = isOffsetTarget(edit.target) ? edit.target : null;
    // Block ids and early-offset replaces usually mean "top" — remap to append-at-end.
    const targetsStart =
      typeof edit.target === "string" ||
      (offset !== null &&
        offset.start === 0 &&
        offset.end > 0 &&
        offset.end < len);

    if (!targetsStart && edit.type === "insert" && offset?.start === len) {
      return {
        ...edit,
        content: ensureSeparatorBeforeAppend(mrkdwn, content ?? ""),
      };
    }

    if (
      edit.type === "insert" &&
      offset &&
      offset.start === 0 &&
      offset.end === 0
    ) {
      return {
        ...edit,
        type: "insert",
        target: endTarget,
        content: ensureSeparatorBeforeAppend(mrkdwn, content ?? ""),
      };
    }

    if (targetsStart) {
      return {
        ...edit,
        type: "insert",
        target: endTarget,
        content: ensureSeparatorBeforeAppend(mrkdwn, content ?? ""),
        rationale: edit.rationale,
      };
    }

    return edit;
  });
}
