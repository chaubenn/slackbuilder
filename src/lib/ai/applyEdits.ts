// Apply structured AI edits against the Slack mrkdwn source string.
// Block-id targeted edits operate on derived text blocks computed via
// tipTapToBlocks; we re-derive offsets at apply time so block ids stay valid
// even after the document changes.

import type { JSONContent } from "@tiptap/react";
import type {
  AiEditResponse,
  MessageBlock,
  StructuredEdit,
} from "../slack/types";
import { tipTapToMrkdwn } from "../slack/tipTapToMrkdwn";
import { tipTapToBlocks } from "../slack/tipTapToBlocks";
import { mrkdwnToTipTap } from "../slack/mrkdwnToTipTap";
import { validateMrkdwn } from "../slack/validateMrkdwn";

export interface ApplyResult {
  document: JSONContent;
  mrkdwn: string;
  appliedEditIds: string[];
  warnings: string[];
}

export function applyEdits(
  doc: JSONContent,
  edits: StructuredEdit[],
  opts: { fullRewrite?: string } = {},
): ApplyResult {
  const warnings: string[] = [];

  // mrkdwn cannot round-trip slackImage / slackLinkUnfurl nodes — the
  // serialiser emits them as <url|alt> Slack links, and the deserialiser
  // recreates them as plain text-with-link-mark, losing the node type and
  // all attributes.  Extract them before the mrkdwn pass and graft them
  // back onto the result so the user's pasted/uploaded images survive edits.
  const nonTextNodes: JSONContent[] = [];
  const textOnlyContent: JSONContent[] = [];
  for (const node of doc.content ?? []) {
    if (node.type === "slackImage" || node.type === "slackLinkUnfurl") {
      nonTextNodes.push(node);
    } else {
      textOnlyContent.push(node);
    }
  }
  const textOnlyDoc: JSONContent = { ...doc, content: textOnlyContent };

  const graftNonText = (resultDoc: JSONContent): JSONContent => {
    if (nonTextNodes.length === 0) return resultDoc;
    return {
      ...resultDoc,
      content: [...(resultDoc.content ?? []), ...nonTextNodes],
    };
  };

  let mrkdwn = tipTapToMrkdwn(textOnlyDoc);

  if (opts.fullRewrite !== undefined) {
    const { fixed, issues } = validateMrkdwn(opts.fullRewrite);
    issues.forEach((i) => warnings.push(`${i.rule}: ${i.message}`));
    return {
      document: graftNonText(mrkdwnToTipTap(fixed)),
      mrkdwn: fixed,
      appliedEditIds: edits.map((e) => e.id),
      warnings,
    };
  }

  const applied: string[] = [];

  // Sort character-offset edits descending so earlier offsets remain valid.
  const offsetEdits = edits.filter((e) => typeof e.target !== "string");
  const blockEdits = edits.filter((e) => typeof e.target === "string");

  for (const edit of blockEdits) {
    const blocks = tipTapToBlocks({ type: "doc", content: parseDoc(mrkdwn) });
    const target = edit.target as string;
    const range = findBlockRange(mrkdwn, blocks, target);
    if (!range) {
      warnings.push(`Could not locate block "${target}" for edit ${edit.id}`);
      continue;
    }
    mrkdwn = applyAtRange(mrkdwn, edit, range);
    applied.push(edit.id);
  }

  for (const edit of [...offsetEdits].sort((a, b) => {
    const aStart = (a.target as { start: number }).start;
    const bStart = (b.target as { start: number }).start;
    return bStart - aStart;
  })) {
    const range = edit.target as { start: number; end: number };
    if (range.start < 0 || range.end > mrkdwn.length || range.start > range.end) {
      warnings.push(`Invalid offset range for edit ${edit.id}`);
      continue;
    }
    mrkdwn = applyAtRange(mrkdwn, edit, range);
    applied.push(edit.id);
  }

  const { fixed, issues } = validateMrkdwn(mrkdwn);
  issues.forEach((i) => warnings.push(`${i.rule}: ${i.message}`));

  return {
    document: graftNonText(mrkdwnToTipTap(fixed)),
    mrkdwn: fixed,
    appliedEditIds: applied,
    warnings,
  };
}

function parseDoc(mrkdwn: string): JSONContent[] {
  return mrkdwnToTipTap(mrkdwn).content ?? [];
}

function applyAtRange(
  mrkdwn: string,
  edit: StructuredEdit,
  range: { start: number; end: number },
): string {
  const before = mrkdwn.slice(0, range.start);
  const after = mrkdwn.slice(range.end);
  switch (edit.type) {
    case "delete":
      return before + after;
    case "insert":
      return before + (edit.content ?? "") + mrkdwn.slice(range.start);
    case "replace":
    case "rewrite_section":
    default:
      return before + (edit.content ?? "") + after;
  }
}

function findBlockRange(
  mrkdwn: string,
  blocks: MessageBlock[],
  blockId: string,
): { start: number; end: number } | null {
  const block = blocks.find((b) => b.blockId === blockId);
  if (!block) return null;

  if (block.type === "text") {
    const needle = block.content.split("\n")[0];
    if (!needle) return null;
    const idx = mrkdwn.indexOf(needle);
    if (idx === -1) return null;
    return { start: idx, end: idx + block.content.length };
  }

  if (block.type === "image" || block.type === "link") {
    const idx = mrkdwn.indexOf(block.url);
    if (idx === -1) return null;
    const closingBracket = mrkdwn.indexOf(">", idx);
    const openBracket = mrkdwn.lastIndexOf("<", idx);
    const start = openBracket === -1 ? idx : openBracket;
    const end = closingBracket === -1 ? idx + block.url.length : closingBracket + 1;
    return { start, end };
  }

  return null;
}

export function summarizeResponse(response: AiEditResponse): string {
  const n = response.edits.length;
  if (n === 0) return "No edits proposed.";
  return `${n} pending edit${n === 1 ? "" : "s"}`;
}
