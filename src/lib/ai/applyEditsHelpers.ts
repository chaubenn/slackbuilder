import type { StructuredEdit } from "../slack/types";

/** Use optionalFullRewrite only for a single full-document rewrite — never with multiple surgical edits. */
export function shouldUseOptionalFullRewrite(
  optionalFullRewrite: string | undefined,
  editsToApply: StructuredEdit[],
  totalPendingEdits: number,
): boolean {
  if (!optionalFullRewrite?.trim()) return false;
  if (editsToApply.length !== totalPendingEdits) return false;
  if (editsToApply.length !== 1) return false;
  return editsToApply[0].type === "rewrite_section";
}
