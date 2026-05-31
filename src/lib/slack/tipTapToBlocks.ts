// Derive the high-level `blocks` view of a TipTap document for AI targeting.
// Each top-level node (paragraph, code block, etc.) becomes its own block so
// targeting text-1 does not mean "the entire message".

import type { JSONContent } from "@tiptap/react";
import type { MessageBlock } from "./types";
import { tipTapToMrkdwn } from "./tipTapToMrkdwn";

function serializeNode(node: JSONContent): string {
  return tipTapToMrkdwn({ type: "doc", content: [node] }).trim();
}

export function tipTapToBlocks(doc: JSONContent | null | undefined): MessageBlock[] {
  if (!doc?.content) return [];
  const blocks: MessageBlock[] = [];
  let textCounter = 1;
  let codeCounter = 1;

  for (const node of doc.content) {
    if (node.type === "slackImage") {
      blocks.push({
        type: "image",
        blockId: (node.attrs?.blockId as string) ?? `image-${blocks.length + 1}`,
        url: (node.attrs?.src as string) ?? "",
        alt: node.attrs?.alt as string | undefined,
      });
    } else if (node.type === "slackLinkUnfurl") {
      blocks.push({
        type: "link",
        blockId:
          (node.attrs?.blockId as string) ?? `link-${blocks.length + 1}`,
        url: (node.attrs?.url as string) ?? "",
        title: node.attrs?.title as string | undefined,
        description: node.attrs?.description as string | undefined,
      });
    } else if (node.type === "codeBlock") {
      const content = serializeNode(node);
      if (content) {
        blocks.push({
          type: "code",
          blockId: `code-${codeCounter++}`,
          content,
        });
      }
    } else {
      const content = serializeNode(node);
      if (content) {
        blocks.push({
          type: "text",
          blockId: `text-${textCounter++}`,
          content,
        });
      }
    }
  }

  return blocks;
}
