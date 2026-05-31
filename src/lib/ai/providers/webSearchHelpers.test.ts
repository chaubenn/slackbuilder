import { describe, expect, it } from "vitest";
import { extractOpenAIResponsesDelta } from "./webSearchHelpers";

describe("extractOpenAIResponsesDelta", () => {
  it("returns delta text from response.output_text.delta events", () => {
    const payload = JSON.stringify({
      type: "response.output_text.delta",
      delta: '{"assistantMessage":',
    });
    expect(extractOpenAIResponsesDelta(payload)).toBe('{"assistantMessage":');
  });

  it("ignores unrelated event types", () => {
    const payload = JSON.stringify({ type: "response.created" });
    expect(extractOpenAIResponsesDelta(payload)).toBe("");
  });
});
