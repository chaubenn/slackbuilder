// Derive the high-level `blocks` view of a TipTap document for AI targeting.

import type { JSONContent } from "@tiptap/react";
import type { MessageBlock } from "./types";
import { tipTapToMrkdwn } from "./tipTapToMrkdwn";

export function tipTapToBlocks(doc: JSONContent | null | undefined): MessageBlock[] {
  if (!doc?.content) return [];
  const blocks: MessageBlock[] = [];
  let textBuffer: JSONContent[] = [];
  let textCounter = 1;

  const flushText = () => {
    if (textBuffer.length === 0) return;
    const fragmentDoc: JSONContent = { type: "doc", content: textBuffer };
    const content = tipTapToMrkdwn(fragmentDoc).trim();
    if (content) {
      blocks.push({
        type: "text",
        blockId: `text-${textCounter++}`,
        content,
      });
    }
    textBuffer = [];
  };

  for (const node of doc.content) {
    if (node.type === "slackImage") {
      flushText();
      blocks.push({
        type: "image",
        blockId: (node.attrs?.blockId as string) ?? `image-${blocks.length + 1}`,
        url: (node.attrs?.src as string) ?? "",
        alt: node.attrs?.alt as string | undefined,
      });
    } else if (node.type === "slackLinkUnfurl") {
      flushText();
      blocks.push({
        type: "link",
        blockId:
          (node.attrs?.blockId as string) ?? `link-${blocks.length + 1}`,
        url: (node.attrs?.url as string) ?? "",
        title: node.attrs?.title as string | undefined,
        description: node.attrs?.description as string | undefined,
      });
    } else {
      textBuffer.push(node);
    }
  }

  flushText();
  return blocks;
}
