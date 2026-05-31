import { describe, expect, it } from "vitest";
import { getModelCapabilities, providerSupportsWebSearch } from "./types";
import { toOpenAIResponsesPayload } from "./providers/webSearchHelpers";

describe("getModelCapabilities", () => {
  it("marks known models with web search support", () => {
    expect(getModelCapabilities("gpt-4o").webSearch).toBe(true);
    expect(getModelCapabilities("claude-sonnet-4-6").webSearch).toBe(true);
    expect(getModelCapabilities("openai/gpt-4o").webSearch).toBe(true);
  });

  it("heuristically enables web search for common model families", () => {
    expect(getModelCapabilities("custom/claude-foo").webSearch).toBe(true);
    expect(getModelCapabilities("o1-mini").webSearch).toBe(false);
  });
});

describe("providerSupportsWebSearch", () => {
  it("is true for all configured providers", () => {
    expect(providerSupportsWebSearch("openai")).toBe(true);
    expect(providerSupportsWebSearch("anthropic")).toBe(true);
    expect(providerSupportsWebSearch("openrouter")).toBe(true);
  });
});

describe("toOpenAIResponsesPayload", () => {
  it("merges system messages into instructions and keeps user/assistant turns", () => {
    const { instructions, input } = toOpenAIResponsesPayload([
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello" },
      { role: "user", content: "Bye" },
    ]);

    expect(instructions).toBe("You are helpful.");
    expect(input).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello" },
      { role: "user", content: "Bye" },
    ]);
  });
});
