// Recognises natural ways a user might say "apply the pending edit":
// "go", "apply", "accept", "do it", "yes", "ok", "put it in",
// "put into the editor", "insert it", "send it", "make the change", etc.
//
// Only matches when the entire input is an apply intent so that follow-up
// messages like "go shorter" or "apply some style" still go to the model
// instead of triggering an apply.
export function isApplyCommand(input: string): boolean {
  const text = input.trim().toLowerCase().replace(/[.!?]+$/, "");
  if (!text) return false;

  if (SHORT_VERBS.has(text)) return true;

  return APPLY_PHRASES.some((re) => re.test(text));
}

const SHORT_VERBS = new Set([
  "go",
  "apply",
  "accept",
  "yes",
  "y",
  "yeah",
  "yep",
  "yup",
  "ok",
  "okay",
  "sure",
  "confirm",
  "confirmed",
  "approved",
  "approve",
  "good",
  "fine",
  "send it",
  "do it",
  "do that",
  "do this",
  "make it so",
  "ship it",
  "accept all",
  "apply all",
  "apply changes",
  "apply edits",
  "apply edit",
  "accept changes",
  "accept edits",
  "looks good",
  "lgtm",
]);

const VERB = "(?:put|insert|paste|drop|stick|place|push|add)";
const OBJECT =
  "(?:it|that|this|them|the\\s+(?:edit|edits|code|change|changes|snippet))";
const PLACE =
  "(?:(?:in|into|to|inside|onto|on)(?:\\s+(?:the\\s+)?(?:editor|message|doc|document|composer))?|in\\s+there|in\\s+here|there|here)";

const APPLY_PHRASES: RegExp[] = [
  // verb + object (+ optional place)
  new RegExp(`^(?:please\\s+)?${VERB}\\s+${OBJECT}(?:\\s+${PLACE})?$`),
  // verb + place (no explicit object — "put into the editor")
  new RegExp(`^(?:please\\s+)?${VERB}\\s+${PLACE}$`),
  // make / do the edit / change
  /^(?:please\s+)?(?:make|do)\s+(?:the|that)\s+(?:edit|edits|change|changes)$/,
  // apply / accept it / that / them / the change
  /^(?:please\s+)?apply\s+(?:it|that|them|those|the\s+(?:edit|edits|change|changes))$/,
  /^(?:please\s+)?accept\s+(?:it|that|them|those|the\s+(?:edit|edits|change|changes))$/,
];
