import type { JSONContent } from "@tiptap/react";

export type MessageBlock =
  | { type: "text"; content: string; blockId: string }
  | { type: "image"; url: string; blockId: string; alt?: string }
  | { type: "video"; url: string; blockId: string }
  | {
      type: "link";
      url: string;
      blockId: string;
      title?: string;
      description?: string;
    };

export interface SlackMessage {
  document: JSONContent;
  content: string;
  blocks: MessageBlock[];
}

export type EditType = "replace" | "insert" | "delete" | "rewrite_section";

export type EditTarget = string | { start: number; end: number };

export interface StructuredEdit {
  id: string;
  type: EditType;
  target: EditTarget;
  content?: string;
  rationale?: string;
}

export interface AiEditResponse {
  assistantMessage: string;
  edits: StructuredEdit[];
  optionalFullRewrite?: string;
}
