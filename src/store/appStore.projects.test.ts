import { beforeEach, describe, expect, it } from "vitest";
import { mrkdwnToTipTap } from "../lib/slack/mrkdwnToTipTap";
import { tipTapToMrkdwn } from "../lib/slack/tipTapToMrkdwn";
import { EMPTY_DOC, useAppStore } from "./appStore";

function resetStore() {
  useAppStore.getState().hydrate({
    document: EMPTY_DOC,
    history: [],
    redoStack: [],
    chat: [],
    pendingResponse: null,
    pendingSelectedEditIds: {},
  });
}

function activeProject() {
  const state = useAppStore.getState();
  return state.projects.find((project) => project.id === state.activeProjectId);
}

describe("project conversations", () => {
  beforeEach(() => {
    resetStore();
  });

  it("creates projects with their own active conversation and document", () => {
    const firstDoc = mrkdwnToTipTap("first project draft");
    useAppStore.getState().setDocument(firstDoc);

    const firstProjectId = useAppStore.getState().activeProjectId;
    useAppStore.getState().createProject("Launch");
    const secondProjectId = useAppStore.getState().activeProjectId;

    expect(secondProjectId).not.toBe(firstProjectId);
    expect(tipTapToMrkdwn(useAppStore.getState().document)).toBe("");

    useAppStore.getState().setDocument(mrkdwnToTipTap("launch draft"));
    useAppStore.getState().switchProject(firstProjectId);
    expect(tipTapToMrkdwn(useAppStore.getState().document)).toBe(
      "first project draft",
    );

    useAppStore.getState().switchProject(secondProjectId);
    expect(tipTapToMrkdwn(useAppStore.getState().document)).toBe("launch draft");
  });

  it("switches conversations and restores matching chat and editor state", () => {
    useAppStore.getState().setDocument(mrkdwnToTipTap("first conversation"));
    useAppStore
      .getState()
      .addChatMessages([{ role: "user", content: "revise first" }]);
    const firstConversationId = activeProject()?.activeConversationId;

    useAppStore.getState().createConversation("Second");
    const secondConversationId = activeProject()?.activeConversationId;
    useAppStore.getState().setDocument(mrkdwnToTipTap("second conversation"));
    useAppStore
      .getState()
      .addChatMessages([{ role: "user", content: "revise second" }]);

    expect(secondConversationId).not.toBe(firstConversationId);

    useAppStore.getState().switchConversation(firstConversationId ?? "");
    expect(tipTapToMrkdwn(useAppStore.getState().document)).toBe(
      "first conversation",
    );
    expect(useAppStore.getState().chat[0]?.content).toBe("revise first");

    useAppStore.getState().switchConversation(secondConversationId ?? "");
    expect(tipTapToMrkdwn(useAppStore.getState().document)).toBe(
      "second conversation",
    );
    expect(useAppStore.getState().chat[0]?.content).toBe("revise second");
  });

  it("clears chat without clearing the editor document", () => {
    useAppStore.getState().setDocument(mrkdwnToTipTap("keep this draft"));
    useAppStore
      .getState()
      .addChatMessages([{ role: "user", content: "please improve" }]);

    useAppStore.getState().clearChat();

    expect(useAppStore.getState().chat).toHaveLength(0);
    expect(tipTapToMrkdwn(useAppStore.getState().document)).toBe(
      "keep this draft",
    );
  });

  it("deletes an active tab and restores the previous tab state", () => {
    useAppStore.getState().setDocument(mrkdwnToTipTap("first tab"));
    const firstConversationId = activeProject()?.activeConversationId;

    useAppStore.getState().createConversation("Second");
    const secondConversationId = activeProject()?.activeConversationId;
    useAppStore.getState().setDocument(mrkdwnToTipTap("second tab"));

    useAppStore.getState().deleteConversation(secondConversationId ?? "");

    const project = activeProject();
    expect(project?.conversations.map((conversation) => conversation.id)).toEqual([
      firstConversationId,
    ]);
    expect(project?.activeConversationId).toBe(firstConversationId);
    expect(tipTapToMrkdwn(useAppStore.getState().document)).toBe("first tab");
  });

  it("renames the active conversation and keeps the editor state intact", () => {
    useAppStore.getState().setDocument(mrkdwnToTipTap("draft body"));
    const id = activeProject()?.activeConversationId ?? "";

    useAppStore.getState().renameConversation(id, "  Release notes  ");

    const tab = activeProject()?.conversations.find((item) => item.id === id);
    expect(tab?.title).toBe("Release notes");
    expect(tipTapToMrkdwn(useAppStore.getState().document)).toBe("draft body");
  });

  it("reorders conversations to match the provided id sequence", () => {
    const firstId = activeProject()?.activeConversationId ?? "";
    useAppStore.getState().createConversation("Second");
    const secondId = activeProject()?.activeConversationId ?? "";
    useAppStore.getState().createConversation("Third");
    const thirdId = activeProject()?.activeConversationId ?? "";

    useAppStore
      .getState()
      .reorderConversations([thirdId, firstId, secondId]);

    expect(
      activeProject()?.conversations.map((item) => item.id),
    ).toEqual([thirdId, firstId, secondId]);
  });

  it("creates a blank replacement when deleting the last tab", () => {
    const onlyConversationId = activeProject()?.activeConversationId;
    useAppStore.getState().setDocument(mrkdwnToTipTap("only tab"));

    useAppStore.getState().deleteConversation(onlyConversationId ?? "");

    const project = activeProject();
    expect(project?.conversations).toHaveLength(1);
    expect(project?.conversations[0]?.id).not.toBe(onlyConversationId);
    expect(tipTapToMrkdwn(useAppStore.getState().document)).toBe("");
    expect(useAppStore.getState().chat).toHaveLength(0);
  });
});
