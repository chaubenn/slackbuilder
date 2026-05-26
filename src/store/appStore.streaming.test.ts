import { beforeEach, describe, expect, it, vi } from "vitest";
import { abortAllStreams, hasStream } from "./streamControllers";
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

function activeProject() {
  const state = useAppStore.getState();
  return state.projects.find((project) => project.id === state.activeProjectId);
}

describe("per-tab AI streaming", () => {
  beforeEach(() => {
    resetStore();
  });

  it("keeps streaming on the source tab after switching away", () => {
    const projectId = useAppStore.getState().activeProjectId;
    const firstId = activeProject()?.activeConversationId ?? "";
    useAppStore.getState().createConversation();
    const secondId = activeProject()?.activeConversationId ?? "";

    const controller = new AbortController();
    useAppStore
      .getState()
      .startStream(projectId, firstId, controller, "hello from tab one");

    useAppStore.getState().switchConversation(secondId);

    const project = useAppStore
      .getState()
      .projects.find((item) => item.id === projectId);
    const firstTab = project?.conversations.find((item) => item.id === firstId);

    expect(useAppStore.getState().isStreaming).toBe(false);
    expect(firstTab?.isStreaming).toBe(true);
    expect(hasStream(projectId, firstId)).toBe(true);
  });

  it("finishStream updates only the originating conversation", () => {
    const projectId = useAppStore.getState().activeProjectId;
    const firstId = activeProject()?.activeConversationId ?? "";
    useAppStore.getState().createConversation();
    const secondId = activeProject()?.activeConversationId ?? "";

    const controller = new AbortController();
    useAppStore
      .getState()
      .startStream(projectId, firstId, controller, "draft update");

    useAppStore.getState().switchConversation(secondId);
    useAppStore.getState().finishStream(projectId, firstId, {
      assistantMessage: "Done on tab one",
      edits: [{ id: "e1", type: "replace", target: "text-0", content: "hi" }],
    });

    const project = useAppStore
      .getState()
      .projects.find((item) => item.id === projectId);
    const firstTab = project?.conversations.find((item) => item.id === firstId);
    const secondTab = project?.conversations.find((item) => item.id === secondId);

    expect(firstTab?.isStreaming).toBe(false);
    expect(firstTab?.pendingResponse?.edits).toHaveLength(1);
    expect(secondTab?.pendingResponse).toBeNull();
    expect(secondTab?.chat).toHaveLength(0);
  });

  it("deleteConversation aborts only the deleted tab stream", () => {
    const projectId = useAppStore.getState().activeProjectId;
    const firstId = activeProject()?.activeConversationId ?? "";
    useAppStore.getState().createConversation();
    const secondId = activeProject()?.activeConversationId ?? "";

    const firstController = new AbortController();
    useAppStore
      .getState()
      .startStream(projectId, firstId, firstController, "tab one");

    useAppStore.getState().switchConversation(secondId);

    const secondController = new AbortController();
    useAppStore
      .getState()
      .startStream(projectId, secondId, secondController, "tab two");

    const abortSpy = vi.spyOn(secondController, "abort");
    useAppStore.getState().deleteConversation(firstId);

    expect(abortSpy).not.toHaveBeenCalled();
    expect(hasStream(projectId, secondId)).toBe(true);
    abortSpy.mockRestore();
  });

  it("hydrate clears streaming flags and controllers", () => {
    const projectId = useAppStore.getState().activeProjectId;
    const conversationId = activeProject()?.activeConversationId ?? "";
    const controller = new AbortController();
    useAppStore
      .getState()
      .startStream(projectId, conversationId, controller, "persist me");

    useAppStore.getState().hydrate({
      hydrated: true,
      projects: useAppStore.getState().projects,
      activeProjectId: projectId,
    });

    const project = useAppStore
      .getState()
      .projects.find((item) => item.id === projectId);
    expect(
      project?.conversations.every((conversation) => !conversation.isStreaming),
    ).toBe(true);
    expect(hasStream(projectId, conversationId)).toBe(false);
  });
});
