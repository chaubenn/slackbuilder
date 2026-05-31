import { beforeEach, describe, expect, it, vi } from "vitest";
import { abortAllStreams } from "./streamControllers";
import { EMPTY_DOC, useAppStore } from "./appStore";

function resetStore() {
  abortAllStreams();
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

describe("cancelStream", () => {
  beforeEach(() => {
    resetStore();
  });

  it("removes the in-flight turn and restores the prompt draft", () => {
    const projectId = useAppStore.getState().activeProjectId;
    const conversationId =
      useAppStore.getState().projects[0]?.activeConversationId ?? "";
    const controller = new AbortController();

    useAppStore
      .getState()
      .startStream(projectId, conversationId, controller, "summarise this draft");

    expect(useAppStore.getState().chat).toHaveLength(2);

    const restored = useAppStore.getState().cancelStream();

    expect(restored).toBe("summarise this draft");
    expect(useAppStore.getState().chat).toHaveLength(0);
    expect(useAppStore.getState().isStreaming).toBe(false);
    expect(
      useAppStore.getState().projects[0]?.conversations[0]?.promptDraft,
    ).toBe("summarise this draft");
  });

  it("aborts the stream controller", () => {
    const projectId = useAppStore.getState().activeProjectId;
    const conversationId =
      useAppStore.getState().projects[0]?.activeConversationId ?? "";
    const controller = new AbortController();
    const abortSpy = vi.spyOn(controller, "abort");

    useAppStore
      .getState()
      .startStream(projectId, conversationId, controller, "hello");

    useAppStore.getState().cancelStream();

    expect(abortSpy).toHaveBeenCalled();
    abortSpy.mockRestore();
  });
});
