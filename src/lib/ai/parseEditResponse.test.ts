import { describe, expect, it } from "vitest";
import { parseAiResponse } from "./parseEditResponse";

describe("parseAiResponse", () => {
  it("extracts JSON from a fenced code block", () => {
    const raw = `Sure thing.
\`\`\`json
{
  "assistantMessage": "shortened",
  "edits": [
    { "id": "e1", "type": "replace", "target": "text-1", "content": "shorter" }
  ]
}
\`\`\``;
    const result = parseAiResponse(raw);
    expect(result.assistantMessage).toBe("shortened");
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0].type).toBe("replace");
    expect(result.edits[0].target).toBe("text-1");
  });

  it("extracts JSON without a fence", () => {
    const raw = `{"assistantMessage":"x","edits":[]}`;
    const result = parseAiResponse(raw);
    expect(result.assistantMessage).toBe("x");
    expect(result.edits).toEqual([]);
  });

  it("falls back to raw text when JSON is missing", () => {
    const raw = "just a chat message with no edits";
    const result = parseAiResponse(raw);
    expect(result.assistantMessage).toBe(raw);
    expect(result.edits).toEqual([]);
  });

  it("ignores edits with unknown types", () => {
    const raw = `\`\`\`json
{
  "assistantMessage": "x",
  "edits": [
    { "type": "magic", "target": "text-1" },
    { "type": "replace", "target": "text-1", "content": "y" }
  ]
}
\`\`\``;
    const result = parseAiResponse(raw);
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0].type).toBe("replace");
  });

  it("accepts offset-based targets", () => {
    const raw = `\`\`\`json
{
  "assistantMessage": "x",
  "edits": [
    { "type": "insert", "target": { "start": 5, "end": 5 }, "content": "abc" }
  ]
}
\`\`\``;
    const result = parseAiResponse(raw);
    expect(result.edits[0].target).toEqual({ start: 5, end: 5 });
  });

  it("unescapes literal \\n in fallback text when no real newlines exist", () => {
    const raw = "python\\ndef twoSum(nums, target):\\n    return []\\n";
    const result = parseAiResponse(raw);
    expect(result.assistantMessage).toBe(
      "python\ndef twoSum(nums, target):\n    return []",
    );
    expect(result.edits).toEqual([]);
  });

  it("preserves real newlines in fallback text instead of double-unescaping", () => {
    const raw = "line one\nline two\\nstillsame";
    const result = parseAiResponse(raw);
    expect(result.assistantMessage).toBe("line one\nline two\\nstillsame");
  });

  it("extracts JSON whose content contains triple backticks", () => {
    const raw = `Sure.
\`\`\`json
{
  "assistantMessage": "added a code block",
  "edits": [
    {
      "id": "e1",
      "type": "rewrite_section",
      "target": "text-1",
      "content": "\`\`\`python\\ndef two_sum(nums, target):\\n    return []\\n\`\`\`",
      "rationale": "Inserting a complete code block."
    }
  ]
}
\`\`\``;
    const result = parseAiResponse(raw);
    expect(result.assistantMessage).toBe("added a code block");
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0].type).toBe("rewrite_section");
    expect(result.edits[0].content).toBe(
      "```python\ndef two_sum(nums, target):\n    return []\n```",
    );
    expect(result.edits[0].rationale).toBe("Inserting a complete code block.");
  });

  it("handles raw JSON object that includes triple backticks in content", () => {
    const raw = `{"assistantMessage":"x","edits":[{"id":"e1","type":"rewrite_section","target":"text-1","content":"\`\`\`py\\nprint(1)\\n\`\`\`"}]}`;
    const result = parseAiResponse(raw);
    expect(result.assistantMessage).toBe("x");
    expect(result.edits[0].content).toBe("```py\nprint(1)\n```");
  });

  it("synthesises a pending rewrite edit when only optionalFullRewrite is given", () => {
    const raw = `\`\`\`json
{
  "assistantMessage": "Proposed a story.",
  "edits": [],
  "optionalFullRewrite": "*Bill Gates* is a tech pioneer."
}
\`\`\``;
    const result = parseAiResponse(raw);
    expect(result.assistantMessage).toBe("Proposed a story.");
    expect(result.optionalFullRewrite).toBe("*Bill Gates* is a tech pioneer.");
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0].type).toBe("rewrite_section");
    expect(result.edits[0].content).toBe("*Bill Gates* is a tech pioneer.");
  });

  it("promotes a rewrite_section edit with no usable target to a full rewrite", () => {
    const raw = `\`\`\`json
{
  "assistantMessage": "Adding a story.",
  "edits": [
    {
      "id": "e1",
      "type": "rewrite_section",
      "target": "doc",
      "content": "*Story* about Bill Gates."
    }
  ]
}
\`\`\``;
    const result = parseAiResponse(raw);
    expect(result.optionalFullRewrite).toBe("*Story* about Bill Gates.");
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0].type).toBe("rewrite_section");
    expect(result.edits[0].content).toBe("*Story* about Bill Gates.");
  });

  it("rejects edits with non-block string targets when there is no full rewrite", () => {
    const raw = `\`\`\`json
{
  "assistantMessage": "x",
  "edits": [
    { "id": "e1", "type": "replace", "target": "doc", "content": "hi" }
  ]
}
\`\`\``;
    const result = parseAiResponse(raw);
    expect(result.edits).toEqual([]);
  });
});
