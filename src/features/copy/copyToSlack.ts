// Bridge from the editor to the native Slack clipboard.
//
// Pipeline:
//   1. Serialize the TipTap doc to Slack mrkdwn (preserves *bold* / <url|label>).
//   2. Convert TipTap JSON -> Quill Delta JSON for Slack's rich clipboard.
//   3. Hand both to the Rust command which writes:
//        • plain text (mrkdwn) as the universal fallback
//        • org.chromium.web-custom-data containing slack/texty Pickle blob
//      Pasting into Slack desktop reads the custom MIME entry and renders
//      identically to the editor preview.

import { invoke } from "@tauri-apps/api/core";
import type { JSONContent } from "@tiptap/react";
import { tipTapToMrkdwn } from "../../lib/slack/tipTapToMrkdwn";
import { tipTapToSlackDelta } from "../../lib/slack/tipTapToSlackDelta";

export interface CopyResult {
  mrkdwn: string;
  deltaJson: string;
  usedNative: boolean;
}

export async function copyMessageToSlack(doc: JSONContent): Promise<CopyResult> {
  const mrkdwn = tipTapToMrkdwn(doc);
  const deltaJson = tipTapToSlackDelta(doc);

  try {
    await invoke("copy_slack_message", {
      plainText: mrkdwn,
      deltaText: deltaJson,
    });
    return { mrkdwn, deltaJson, usedNative: true };
  } catch (err) {
    // Web/dev fallback: best-effort plain text copy.
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(mrkdwn);
      return { mrkdwn, deltaJson, usedNative: false };
    }
    throw err;
  }
}
