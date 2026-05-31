// Apply structured AI edits against the Slack mrkdwn source string.
// Block-id targeted edits operate on derived text blocks computed via
// tipTapToBlocks; we re-derive offsets at apply time so block ids stay valid
// even after the document changes.

import type { JSONContent } from "@tiptap/react";
import type {
  AiEditResponse,
  EditTarget,
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
  const moveEdits = edits.filter((e) => e.type === "move");
  const blockEdits = edits.filter(
    (e) => e.type !== "move" && typeof e.target === "string",
  );
  const offsetEdits = edits.filter(
    (e) => e.type !== "move" && typeof e.target !== "string",
  );

  for (const edit of [...moveEdits].sort(
    (a, b) => sourceStart(mrkdwn, b) - sourceStart(mrkdwn, a),
  )) {
    const blocks = tipTapToBlocks({ type: "doc", content: parseDoc(mrkdwn) });
    const next = applyMove(mrkdwn, edit, blocks, warnings);
    if (next !== mrkdwn) applied.push(edit.id);
    mrkdwn = next;
  }

  for (const edit of blockEdits) {
    const blocks = tipTapToBlocks({ type: "doc", content: parseDoc(mrkdwn) });
    const target = edit.target as string;
    const range = findBlockRange(mrkdwn, blocks, target);
    if (!range) {
      warnings.push(`Could not locate block "${target}" for edit ${edit.id}`);
      continue;
    }
    mrkdwn = applyAtRange(mrkdwn, edit, range, { blockTarget: true });
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

function sourceStart(mrkdwn: string, edit: StructuredEdit): number {
  const blocks = tipTapToBlocks({ type: "doc", content: parseDoc(mrkdwn) });
  const range = findBlockRange(mrkdwn, blocks, edit.target as string);
  if (range) return range.start;
  const t = edit.target as { start?: number };
  return typeof t.start === "number" ? t.start : 0;
}

function resolveInsertIndex(
  mrkdwn: string,
  blocks: MessageBlock[],
  destination: EditTarget,
): number | null {
  if (typeof destination === "string") {
    const range = findBlockRange(mrkdwn, blocks, destination);
    return range ? range.end : null;
  }
  return destination.start;
}

function applyMove(
  mrkdwn: string,
  edit: StructuredEdit,
  blocks: MessageBlock[],
  warnings: string[],
): string {
  if (!edit.destination) {
    warnings.push(`Move edit ${edit.id} missing destination`);
    return mrkdwn;
  }

  const sourceRange = findBlockRange(mrkdwn, blocks, edit.target as string);
  if (!sourceRange) {
    warnings.push(
      `Could not locate source "${edit.target}" for move ${edit.id}`,
    );
    return mrkdwn;
  }

  let destIdx = resolveInsertIndex(mrkdwn, blocks, edit.destination);
  if (destIdx === null) {
    warnings.push(`Could not locate destination for move ${edit.id}`);
    return mrkdwn;
  }

  const slice = mrkdwn.slice(sourceRange.start, sourceRange.end);
  const removedLen = sourceRange.end - sourceRange.start;

  let result = mrkdwn.slice(0, sourceRange.start) + mrkdwn.slice(sourceRange.end);

  if (destIdx > sourceRange.end) {
    destIdx -= removedLen;
  } else if (destIdx > sourceRange.start) {
    destIdx = sourceRange.start;
  }

  const before = result.slice(0, destIdx);
  const needsGap =
    before.trim().length > 0 && slice.trim().length > 0 && !before.endsWith("\n");
  const gap = needsGap ? (before.endsWith("\n") ? "" : "\n\n") : "";
  result = before + gap + slice + result.slice(destIdx);

  return result;
}

function applyAtRange(
  mrkdwn: string,
  edit: StructuredEdit,
  range: { start: number; end: number },
  opts: { blockTarget?: boolean } = {},
): string {
  const before = mrkdwn.slice(0, range.start);
  const after = mrkdwn.slice(range.end);
  switch (edit.type) {
    case "delete":
      return before + after;
    case "insert": {
      const at =
        opts.blockTarget && range.start !== range.end
          ? range.end
          : range.start;
      return mrkdwn.slice(0, at) + (edit.content ?? "") + mrkdwn.slice(at);
    }
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

  if (block.type === "text" || block.type === "code") {
    return findOrderedContentRange(mrkdwn, blocks, block);
  }

  if (block.type === "image" || block.type === "link") {
    const idx = mrkdwn.indexOf(block.url);
    if (idx === -1) return null;
    const closingBracket = mrkdwn.indexOf(">", idx);
    const openBracket = mrkdwn.lastIndexOf("<", idx);
    const start = openBracket === -1 ? idx : openBracket;
    const end =
      closingBracket === -1 ? idx + block.url.length : closingBracket + 1;
    return { start, end };
  }

  return null;
}

function findOrderedContentRange(
  mrkdwn: string,
  blocks: MessageBlock[],
  block: MessageBlock & { content: string },
): { start: number; end: number } | null {
  const peers = blocks.filter((b) => b.type === block.type);
  const index = peers.findIndex((b) => b.blockId === block.blockId);
  if (index === -1) return null;

  let from = 0;
  for (let i = 0; i <= index; i++) {
    const peer = peers[i] as MessageBlock & { content: string };
    const idx = mrkdwn.indexOf(peer.content, from);
    if (idx === -1) return null;
    if (i === index) {
      return { start: idx, end: idx + peer.content.length };
    }
    from = idx + peer.content.length;
  }
  return null;
}

export function summarizeResponse(response: AiEditResponse): string {
  const n = response.edits.length;
  if (n === 0) return "No edits proposed.";
  return `${n} pending edit${n === 1 ? "" : "s"}`;
}
