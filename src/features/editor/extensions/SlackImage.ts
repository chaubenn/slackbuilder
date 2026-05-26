import { Node, mergeAttributes } from "@tiptap/core";
import { nanoid } from "nanoid";

export interface SlackImageOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    slackImage: {
      insertSlackImage: (attrs: {
        src: string;
        alt?: string;
        blockId?: string;
      }) => ReturnType;
    };
  }
}

export const SlackImage = Node.create<SlackImageOptions>({
  name: "slackImage",
  group: "block",
  draggable: true,
  selectable: true,
  atom: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      blockId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-block-id"),
        renderHTML: (attrs) => ({ "data-block-id": attrs.blockId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-slack-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { class: "slack-image", "data-slack-image": "true" },
        this.options.HTMLAttributes,
        { "data-block-id": HTMLAttributes.blockId ?? "" },
      ),
      [
        "img",
        {
          src: HTMLAttributes.src ?? "",
          alt: HTMLAttributes.alt ?? "",
        },
      ],
    ];
  },

  addCommands() {
    return {
      insertSlackImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              src: attrs.src,
              alt: attrs.alt ?? "",
              blockId: attrs.blockId ?? `image-${nanoid(6)}`,
            },
          }),
    };
  },
});
