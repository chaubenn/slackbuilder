# Slackbuilder

An AI-powered Slack message composer that runs as a local **Tauri 2** desktop app. The editor is a WYSIWYG surface styled like Slack; a side panel runs a Cursor-style AI loop that proposes **structured edits** you accept, reject, or partially apply. **Copy to Slack** writes Slack's native clipboard format so pastes into the Slack desktop client preserve formatting exactly.

## Highlights

- **Slack-faithful WYSIWYG editor** — TipTap with Slack-specific marks, lists, code blocks, block quotes, link unfurls, and image blocks.
- **Native `slack/texty` clipboard** — a Rust command writes a Chromium Pickle payload so Slack desktop reads pasted formatting losslessly.
- **AI pair-writer** — streaming OpenAI / Anthropic / OpenRouter providers, a Slack-aware system prompt, and a structured edit protocol with per-edit accept/reject and undo/redo.
- **Default-to-editing** — the model treats every prompt as a request to change the current message and returns structured edits (not standalone chat). Images are read and woven into the message, not answered only in the chat panel.
- **Natural-language apply** — type `go`, `apply`, `yes`, `put it in the editor`, and similar phrases to accept pending edits without clicking.
- **Cross-provider model picker** — switch provider and model from the chat footer in one menu (vision and reasoning models are marked with eye / brain icons). API keys and custom models live in Settings.
- **Vision** — paste or attach an image in the AI chat; supported models receive it as a vision content block.
- **Multi-tab conversations** — Cmd/Ctrl+T new tab, Cmd/Ctrl+W close, drag to reorder. Each tab has its own editor, AI history, pending edits, and undo stack, persisted locally. Streaming continues on a tab if you switch away mid-response.
- **Local-only** — API keys are stored in the Tauri store on disk. Requests go directly from the app to the provider you choose.
- **Bidirectional mrkdwn** — serialiser + parser keep the document round-trippable so the AI edits the same surface you do.

## Architecture

```
src/
├── lib/
│   ├── slack/                 # mrkdwn ↔ TipTap, block derivation, validator
│   ├── ai/
│   │   ├── types.ts           # providers, model capabilities, presets
│   │   ├── providers/openai.ts
│   │   ├── systemPrompt.ts    # Slack-aware prompt + context builder
│   │   ├── parseEditResponse.ts
│   │   └── applyEdits.ts
│   └── utils.ts
├── features/
│   ├── editor/                # SlackEditor, toolbar, custom nodes
│   ├── ai/                    # AiChatPanel, PendingEditCard, apply phrases
│   ├── copy/                  # Copy-to-Slack (TipTap → mrkdwn → Quill → Rust)
│   └── settings/              # API keys, theme, custom model / base URL
├── components/
│   ├── EditorTabs.tsx         # Multi-tab strip, drag reorder, shortcuts
│   ├── ResizableSplitPane.tsx
│   └── TitleBar.tsx
├── store/
│   ├── appStore.ts            # per-tab state, streaming, undo/redo
│   ├── persistence.ts
│   └── streamControllers.ts
└── App.tsx
src-tauri/
└── src/clipboard.rs           # copy_slack_message / read_slack_clipboard
```

The TipTap JSON document is the source of truth per tab. `content` (Slack mrkdwn) and `blocks` (block list with stable ids) are derived for AI context and Copy-to-Slack.

## Slack mrkdwn rules

Per [Slack formatting docs](https://docs.slack.dev/messaging/formatting-message-text):


| Mark          | Slack mrkdwn              |
| ------------- | ------------------------- |
| Bold          | `*bold*`                  |
| Italic        | `_italic_`                |
| Strikethrough | `~strike~`                |
| Inline code   | ``code``                  |
| Code block    | ````code````              |
| Block quote   | `> line`                  |
| Link          | `<url>` or `<url|label>`  |
| Escape        | `&` `<` `>` → `&` `<` `>` |


The system prompt enforces these rules; `validateMrkdwn` auto-fixes common model mistakes (`**bold**`, `~~strike~~`, `[label](url)`, ATX headings) before applying edits.

## Running

**Prerequisites:** Node 18+, Rust stable, and [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
source "$HOME/.cargo/env" # follow steps to download Rust 
npm install
npm run tauri dev          # desktop app
npm run test               # Vitest
cd src-tauri && cargo test # Rust clipboard tests
```

Release build:

```bash
npm run tauri build
# macOS DMG: src-tauri/target/release/bundle/dmg/
```

## AI setup

1. Open **Settings** (gear in the AI panel) and add an API key for at least one provider.
2. Pick **provider + model** from the dropdown in the chat footer, or set a custom model / base URL in Settings.


| Provider   | Default base URL               | Default model                 |
| ---------- | ------------------------------ | ----------------------------- |
| OpenAI     | `https://api.openai.com/v1`    | `gpt-4o-mini`                 |
| Anthropic  | `https://api.anthropic.com/v1` | `claude-sonnet-4-6`           |
| OpenRouter | `https://openrouter.ai/api/v1` | `anthropic/claude-3.5-sonnet` |


The Anthropic adapter sets `anthropic-dangerous-direct-browser-access: true` so requests work from Tauri's webview without a proxy.

**Vision:** paste an image into the chat (Cmd+V). A thumbnail appears; on send, the image is sent as base64 to vision-capable models. The model is instructed to put image-derived content into the editor via structured edits, not only in chat.

**Apply pending edits:** use the checkboxes on each proposed edit, or send a short apply phrase (`go`, `apply`, `yes`, `put it in the editor`, …). Phrases must be the whole message so follow-ups like `go shorter` still go to the model.

## Copy-to-Slack

1. TipTap → Slack mrkdwn (`tipTapToMrkdwn`).
2. Mrkdwn → Quill Delta (`@slackfmt/core` `markdownToDelta`).
3. Rust `copy_slack_message` writes plain text plus `org.chromium.web-custom-data` (`slack/texty` Pickle).
4. Slack desktop reads the custom data and reconstructs formatting.

Without Tauri (e.g. Vite-only in a browser), the app falls back to plain mrkdwn on the system clipboard.

## Testing


| Area                              | Location                                                       |
| --------------------------------- | -------------------------------------------------------------- |
| mrkdwn serialise / parse / blocks | `src/lib/slack/*.test.ts`                                      |
| AI parse + apply                  | `src/lib/ai/*.test.ts`, `src/features/ai/applyCommand.test.ts` |
| Store (tabs, streaming, history)  | `src/store/*.test.ts`                                          |
| Clipboard Pickle round-trip       | `src-tauri/src/clipboard.rs` (`#[cfg(test)]`)                  |


```bash
npm run test
npm run test:watch   # watch mode
```

## Keyboard shortcuts


| Shortcut         | Action                      |
| ---------------- | --------------------------- |
| Cmd/Ctrl+T       | New tab (focuses AI prompt) |
| Cmd/Ctrl+W       | Close current tab           |
| Cmd/Ctrl+1–9     | Switch to tab N             |
| Cmd/Ctrl+Shift+C | Copy to Slack               |
| Enter            | Send AI message             |
| Shift+Enter      | Newline in AI input         |


## Contributing / roadmap

Team backlog and QA flow live in `[ISSUES.md](./ISSUES.md)` (kanban-style: Backlog → QA → Done).

Known gaps tracked there include: insert-position accuracy for bottom-of-message edits, restoring the prompt after cancel, local model support, and web search.

## Limitations

- Local image files are embedded as `data:` URLs; large assets may need a proper upload path later.
- `read_slack_clipboard` exists in Rust but is not wired in the UI yet (paste-from-Slack).
- OpenRouter: choose a vision-capable model explicitly when sending images (e.g. `openai/gpt-4o`).
- macOS DMG window background / icon layout is configurable at build time via `bundle.macOS.dmg` in `src-tauri/tauri.conf.json` (only affects release bundles, not `tauri dev`).

