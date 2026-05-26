// Slack mrkdwn uses `&`, `<`, `>` as control characters. When they appear in
// user text and are not part of a control sequence (mention, link, !date, etc.)
// they must be HTML-entity encoded so Slack renders them literally.

export function escapeSlackText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function unescapeSlackText(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
