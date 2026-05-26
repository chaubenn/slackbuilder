import { beforeEach, describe, expect, it } from "vitest";
import { mrkdwnToTipTap } from "../lib/slack/mrkdwnToTipTap";
import { tipTapToMrkdwn } from "../lib/slack/tipTapToMrkdwn";
import { useAppStore, EMPTY_DOC } from "./appStore";

function resetStore() {
  useAppStore.getState().hydrate({
    document: EMPTY_DOC,
    history: [],
    redoStack: [],
    chat: [],
    pendingResponse: null,
    pendingSelectedEditIds: {},
    isStreaming: false,
    hydrated: true,
  });
}

describe("AI edit undo/redo", () => {
  beforeEach(() => {
    resetStore();
  });

  it("undo restores before and pushes entry onto redo stack", () => {
    const before = mrkdwnToTipTap("hello");
    const after = mrkdwnToTipTap("hello world");

    useAppStore.getState().setDocument(before);
    useAppStore.getState().acceptEdits({ document: after, editIds: ["e1"] });

    useAppStore.getState().revertLastAiChange();

    expect(tipTapToMrkdwn(useAppStore.getState().document)).toBe("hello");
    expect(useAppStore.getState().history).toHaveLength(0);
    expect(useAppStore.getState().redoStack).toHaveLength(1);
  });

  it("redo restores after and moves entry back to history", () => {
    const before = mrkdwnToTipTap("hello");
    const after = mrkdwnToTipTap("hello world");

    useAppStore.getState().setDocument(before);
    useAppStore.getState().acceptEdits({ document: after, editIds: ["e1"] });
    useAppStore.getState().revertLastAiChange();
    useAppStore.getState().redoLastAiChange();

    expect(tipTapToMrkdwn(useAppStore.getState().document)).toBe("hello world");
    expect(useAppStore.getState().history).toHaveLength(1);
    expect(useAppStore.getState().redoStack).toHaveLength(0);
  });

  it("new acceptEdits clears the redo stack", () => {
    const docA = mrkdwnToTipTap("one");
    const docB = mrkdwnToTipTap("two");
    const docC = mrkdwnToTipTap("three");

    useAppStore.getState().setDocument(docA);
    useAppStore.getState().acceptEdits({ document: docB, editIds: ["e1"] });
    useAppStore.getState().revertLastAiChange();

    useAppStore.getState().acceptEdits({ document: docC, editIds: ["e2"] });

    expect(useAppStore.getState().redoStack).toHaveLength(0);
    expect(useAppStore.getState().history).toHaveLength(1);
  });

  it("resetMessage clears history and redo stack", () => {
    const before = mrkdwnToTipTap("hello");
    const after = mrkdwnToTipTap("hello world");

    useAppStore.getState().setDocument(before);
    useAppStore.getState().acceptEdits({ document: after, editIds: ["e1"] });
    useAppStore.getState().revertLastAiChange();
    useAppStore.getState().resetMessage();

    expect(useAppStore.getState().history).toHaveLength(0);
    expect(useAppStore.getState().redoStack).toHaveLength(0);
  });
});
