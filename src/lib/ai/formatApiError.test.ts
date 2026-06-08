import { describe, expect, it } from "vitest";
import {
  formatApiErrorMessage,
  formatProviderHttpError,
} from "./formatApiError";

describe("formatProviderHttpError", () => {
  it("formats OpenAI invalid API key errors without raw JSON", () => {
    const body = JSON.stringify({
      error: {
        message:
          "Incorrect API key provided: wporekgeokrg. You can find your API key at https://platform.openai.com/account/api-keys.",
        type: "invalid_request_error",
        param: null,
        code: "invalid_api_key",
      },
    });

    expect(formatProviderHttpError("OpenAI", 401, body)).toBe(
      "Invalid API key for OpenAI. Check your key in Settings.",
    );
  });

  it("formats Anthropic authentication errors without raw JSON", () => {
    const body = JSON.stringify({
      type: "error",
      error: {
        type: "authentication_error",
        message: "invalid x-api-key",
      },
      request_id: "req_011CbqonkFYjicahMJNFAyBg",
    });

    expect(formatProviderHttpError("Anthropic", 401, body)).toBe(
      "Invalid API key for Anthropic. Check your key in Settings.",
    );
  });

  it("keeps a readable message for non-auth errors", () => {
    const body = JSON.stringify({
      error: { message: "Rate limit reached. Try again in 30s." },
    });

    expect(formatProviderHttpError("OpenAI", 429, body)).toBe(
      "OpenAI error (429): Rate limit reached. Try again in 30s.",
    );
  });
});

describe("formatApiErrorMessage", () => {
  it("cleans up legacy provider error strings", () => {
    const raw =
      'Anthropic error 401: {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CbqonkFYjicahMJNFAyBg"}';

    expect(formatApiErrorMessage(raw)).toBe(
      "Invalid API key for Anthropic. Check your key in Settings.",
    );
  });
});
