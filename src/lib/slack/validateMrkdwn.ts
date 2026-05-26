// Validate and auto-fix common Slack mrkdwn mistakes that LLMs love to make.

export interface ValidationIssue {
  rule: string;
  message: string;
}

export interface ValidationResult {
  fixed: string;
  issues: ValidationIssue[];
}

export function validateMrkdwn(input: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  let text = input;

  // `**bold**` -> `*bold*`
  if (/\*\*[^*]+\*\*/.test(text)) {
    issues.push({
      rule: "no-double-asterisk-bold",
      message: "Slack uses *bold*, not **bold**",
    });
    text = text.replace(/\*\*([^*]+)\*\*/g, "*$1*");
  }

  // `~~strike~~` -> `~strike~`
  if (/~~[^~]+~~/.test(text)) {
    issues.push({
      rule: "no-double-tilde-strike",
      message: "Slack uses ~strike~, not ~~strike~~",
    });
    text = text.replace(/~~([^~]+)~~/g, "~$1~");
  }

  // `__italic__` -> `_italic_`
  if (/__[^_]+__/.test(text)) {
    issues.push({
      rule: "no-double-underscore-italic",
      message: "Slack uses _italic_, not __italic__",
    });
    text = text.replace(/__([^_]+)__/g, "_$1_");
  }

  // Standard markdown links `[label](url)` -> `<url|label>`
  if (/\[[^\]]+\]\([^)]+\)/.test(text)) {
    issues.push({
      rule: "use-slack-link-syntax",
      message: "Use <url|label> instead of [label](url)",
    });
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");
  }

  // ATX-style headings `# Heading` aren't supported in mrkdwn.
  text = text.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, title) => {
    issues.push({
      rule: "no-headings",
      message: `Replaced ${hashes} heading with bold (Slack has no headings)`,
    });
    return `*${title}*`;
  });

  // Some models describe formatting literally, e.g. `bold Section Title`.
  // Treat only standalone title-like lines as pseudo-formatting commands.
  text = text.replace(
    /^(bold|italic)\s+([A-Z][^\n]{2,80})$/gm,
    (_, style: string, title: string) => {
      issues.push({
        rule: "no-literal-formatting-labels",
        message: `Replaced literal "${style}" prefix with Slack ${style} markup`,
      });
      const marker = style.toLowerCase() === "bold" ? "*" : "_";
      return `${marker}${title.trim()}${marker}`;
    },
  );

  // `***bold-italic***` is not valid; keep it simple, drop one asterisk.
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "*_$1_*");

  return { fixed: text, issues };
}
