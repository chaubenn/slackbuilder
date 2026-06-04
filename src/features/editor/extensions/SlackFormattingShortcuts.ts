import { Extension } from "@tiptap/core";
import { OPEN_LINK_DIALOG_EVENT } from "../../../lib/slackFormatShortcuts";

/** TipTap keymap aligned with Slack's message formatting shortcuts. */
export const SlackFormattingShortcuts = Extension.create({
  name: "slackFormattingShortcuts",

  addKeyboardShortcuts() {
    return {
      "Mod-b": () => this.editor.commands.toggleBold(),
      "Mod-i": () => this.editor.commands.toggleItalic(),
      "Mod-Shift-x": () => this.editor.commands.toggleStrike(),
      "Mod-Shift-c": () => this.editor.commands.toggleCode(),
      "Mod-Alt-Shift-c": () => this.editor.commands.toggleCodeBlock(),
      "Mod-Shift-9": () => this.editor.commands.toggleBlockquote(),
      "Mod-Shift-8": () => this.editor.commands.toggleBulletList(),
      "Mod-Shift-7": () => this.editor.commands.toggleOrderedList(),
      "Mod-Shift-u": () => {
        window.dispatchEvent(new CustomEvent(OPEN_LINK_DIALOG_EVENT));
        return true;
      },
    };
  },
});
