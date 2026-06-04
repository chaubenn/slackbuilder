/** Matches Slack desktop formatting shortcuts (help article 201374536). */

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/i.test(navigator.platform);

export const MOD_LABEL = IS_MAC ? "Cmd" : "Ctrl";
const ALT_LABEL = IS_MAC ? "Option" : "Alt";

function keysLabel(keys: string[]): string {
  return keys
    .map((key) => {
      if (key === "Mod") return MOD_LABEL;
      if (key === "Alt") return ALT_LABEL;
      return key;
    })
    .join("+");
}

export function toolbarTitle(label: string, keys: string[]): string {
  return `${label} (${keysLabel(keys)})`;
}

/** Slack message-composer formatting shortcuts */
export const SLACK_FORMAT = {
  bold: toolbarTitle("Bold", ["Mod", "B"]),
  italic: toolbarTitle("Italic", ["Mod", "I"]),
  strikethrough: toolbarTitle("Strikethrough", ["Mod", "Shift", "X"]),
  codeSnippet: toolbarTitle("Code snippet", ["Mod", "Shift", "C"]),
  codeBlock: toolbarTitle("Code block", ["Mod", "Alt", "Shift", "C"]),
  blockQuote: toolbarTitle("Block quote", ["Mod", "Shift", "9"]),
  bulletList: toolbarTitle("Bulleted list", ["Mod", "Shift", "8"]),
  numberedList: toolbarTitle("Numbered list", ["Mod", "Shift", "7"]),
  link: toolbarTitle("Add link", ["Mod", "Shift", "U"]),
  undo: toolbarTitle("Undo", ["Mod", "Z"]),
  redo: toolbarTitle("Redo", ["Mod", "Shift", "Z"]),
  /** Slack messaging shortcut (upload file); opens image file picker in Slackbuilder */
  insertImage: toolbarTitle("Insert image", ["Mod", "U"]),
} as const;

/** Slackbuilder-specific shortcuts (not Slack composer formatting) */
export const APP_SHORTCUTS = {
  copyToSlack: toolbarTitle("Copy to Slack", ["Mod", "Shift", "C"]),
} as const;

export const OPEN_LINK_DIALOG_EVENT = "slackbuilder:open-link-dialog";
