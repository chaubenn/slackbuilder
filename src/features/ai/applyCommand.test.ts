import { describe, expect, it } from "vitest";
import { isApplyCommand } from "./applyCommand";

describe("isApplyCommand", () => {
  it.each([
    "go",
    "GO",
    "apply",
    "Apply",
    "accept",
    "do it",
    "Do it.",
    "yes",
    "yeah",
    "ok",
    "okay",
    "sure",
    "confirm",
    "approved",
    "looks good",
    "lgtm",
    "put it in",
    "put it in the editor",
    "put into the editor",
    "put it into the editor",
    "put that in there",
    "insert it",
    "insert it into the message",
    "paste it in",
    "drop it in",
    "add it to the message",
    "make the change",
    "make the changes",
    "apply the edits",
    "accept the change",
  ])("recognises '%s' as an apply command", (phrase) => {
    expect(isApplyCommand(phrase)).toBe(true);
  });

  it.each([
    "",
    "no",
    "shorten this",
    "make it more technical",
    "write a story about bill gates",
    "rewrite the second paragraph",
    "what",
    "who is bill gates",
    "go shorter",
    "apply some style",
  ])("does not match '%s'", (phrase) => {
    expect(isApplyCommand(phrase)).toBe(false);
  });
});
