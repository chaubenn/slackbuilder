import { describe, expect, it } from "vitest";
import { parseAskResponse } from "./parseEditResponse";

describe("parseAskResponse", () => {
  it("uses plain prose as the assistant message", () => {
    const result = parseAskResponse("## Summary\n\n- Point one");
    expect(result.assistantMessage).toContain("Summary");
    expect(result.edits).toEqual([]);
  });

  it("extracts assistantMessage from accidental JSON", () => {
    const result = parseAskResponse(
      '```json\n{"assistantMessage":"Here is the answer.","edits":[]}\n```',
    );
    expect(result.assistantMessage).toBe("Here is the answer.");
    expect(result.edits).toEqual([]);
  });
});
