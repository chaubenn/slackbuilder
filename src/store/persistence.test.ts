import { describe, expect, it } from "vitest";
import { PROVIDERS } from "../lib/ai/types";
import { mrkdwnToTipTap } from "../lib/slack/mrkdwnToTipTap";
import { tipTapToMrkdwn } from "../lib/slack/tipTapToMrkdwn";
import { snapshotToHydration } from "./persistence";

describe("persistence migration", () => {
  it("migrates v1 snapshots into a default project and conversation", () => {
    const hydration = snapshotToHydration({
      document: mrkdwnToTipTap("saved draft"),
      chat: [{ id: "m1", role: "user", content: "make this clearer" }],
      settings: {
        provider: "openai",
        apiKey: "local-key",
        model: PROVIDERS.openai.defaultModel,
        baseUrl: PROVIDERS.openai.defaultBaseUrl,
      },
      history: [],
      ui: { aiPanelWidth: 512 },
    });

    expect(hydration?.activeProjectId).toBe("default-project");
    expect(hydration?.projects).toHaveLength(1);

    const project = hydration?.projects[0];
    const conversation = project?.conversations[0];
    expect(project?.activeConversationId).toBe("default-conversation");
    expect(conversation?.title).toBe("make this clearer");
    expect(conversation?.chat[0]?.content).toBe("make this clearer");
    expect(tipTapToMrkdwn(conversation?.document ?? { type: "doc" })).toBe(
      "saved draft",
    );
    expect(hydration?.ui.aiPanelWidth).toBe(512);
  });
});
