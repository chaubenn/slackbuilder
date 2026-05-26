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
});
