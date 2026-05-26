import { Node, mergeAttributes } from "@tiptap/core";
import { nanoid } from "nanoid";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    slackLinkUnfurl: {
      insertSlackLinkUnfurl: (attrs: {
        url: string;
        title?: string;
        description?: string;
        blockId?: string;
      }) => ReturnType;
    };
  }
}

export const SlackLinkUnfurl = Node.create({
  name: "slackLinkUnfurl",
  group: "block",
  draggable: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      url: { default: "" },
      title: { default: "" },
      description: { default: "" },
      blockId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-block-id"),
        renderHTML: (attrs) => ({ "data-block-id": attrs.blockId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-slack-link-unfurl]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const title = (HTMLAttributes.title as string) || (HTMLAttributes.url as string) || "";
    const desc = (HTMLAttributes.description as string) || "";
    return [
      "div",
      mergeAttributes(
        { class: "slack-link-unfurl", "data-slack-link-unfurl": "true" },
        { "data-block-id": HTMLAttributes.blockId ?? "" },
      ),
      ["div", { class: "lu-title" }, title],
      ["div", { class: "lu-desc" }, desc],
    ];
  },

  addCommands() {
    return {
      insertSlackLinkUnfurl:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              url: attrs.url,
              title: attrs.title ?? "",
              description: attrs.description ?? "",
              blockId: attrs.blockId ?? `link-${nanoid(6)}`,
            },
          }),
    };
  },
});
