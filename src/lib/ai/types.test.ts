import { describe, expect, it } from "vitest";
import {
  getApiKeys,
  getConfiguredProviders,
  getModelCapabilities,
  providerSupportsWebSearch,
} from "./types";
import { toOpenAIResponsesPayload } from "./providers/webSearchHelpers";

describe("getApiKeys", () => {
  it("reads per-provider keys and falls back to legacy apiKey", () => {
    expect(
      getApiKeys({
        provider: "openai",
        apiKey: "sk-openai",
        apiKeys: { anthropic: "sk-claude" },
      }),
    ).toEqual({
      openai: "sk-openai",
      anthropic: "sk-claude",
      openrouter: "",
    });
  });
});

describe("getConfiguredProviders", () => {
  it("returns only providers with a non-empty key", () => {
    expect(
      getConfiguredProviders({
        provider: "openai",
        apiKey: "",
        apiKeys: {
          openai: "sk-openai",
          openrouter: "sk-or",
        },
      }),
    ).toEqual(["openai", "openrouter"]);
  });

  it("includes legacy apiKey for the active provider", () => {
    expect(
      getConfiguredProviders({
        provider: "anthropic",
        apiKey: "sk-claude",
        apiKeys: {},
      }),
    ).toEqual(["anthropic"]);
  });
});

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
