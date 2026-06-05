import { describe, expect, it } from "vitest";
import {
  COPY_BUTTON_COLLAPSE_BUFFER,
  COPY_BUTTON_FULL_WIDTH,
  shouldCompactCopyButton,
} from "./copyButtonLayout";

describe("shouldCompactCopyButton", () => {
  it("returns true when toolbar is narrower than required space", () => {
    const toolsWidth = 420;
    const required =
      toolsWidth + COPY_BUTTON_FULL_WIDTH + COPY_BUTTON_COLLAPSE_BUFFER;

    expect(shouldCompactCopyButton(required - 1, toolsWidth)).toBe(true);
  });

  it("returns false when toolbar can fit full button", () => {
    const toolsWidth = 420;
    const required =
      toolsWidth + COPY_BUTTON_FULL_WIDTH + COPY_BUTTON_COLLAPSE_BUFFER;

    expect(shouldCompactCopyButton(required, toolsWidth)).toBe(false);
    expect(shouldCompactCopyButton(required + 40, toolsWidth)).toBe(false);
  });
});
