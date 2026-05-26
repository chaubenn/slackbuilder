# Slackbuilder

An AI-powered Slack message composer that runs as a local Tauri 2 desktop app. The editor is a WYSIWYG surface styled like Slack, and a second panel runs a Cursor-style AI loop that proposes structured edits you can accept, reject, or partially apply. "Copy to Slack" uses Slack's native clipboard format so pastes into the Slack desktop client preserve formatting exactly.

## Highlights

- **Slack-faithful WYSIWYG editor** built on TipTap with Slack-specific marks, lists, code blocks, block quotes, link unfurls, and image blocks.
- **Native `slack/texty` clipboard** via a small Rust command that writes a Chromium Pickle payload, so Slack desktop reads pasted formatting losslessly.
- **AI pair-writer panel** with streaming OpenAI / Anthropic / OpenRouter providers, a Slack-aware system prompt, and a structured edit protocol with per-edit accept/reject and undo/redo.
- **Vision support** — paste or drop an image into the AI chat and ask the model to analyse it or incorporate it into your message (works with gpt-4o, claude-sonnet-4-6, and any OpenRouter vision model).
- **"Apply to editor" escape hatch** — if the AI responds with prose instead of structured edits, a one-click button parses the response as mrkdwn and applies it directly to the editor with undo support.
- **Multi-tab conversations** — Cmd/Ctrl+T for a new tab, Cmd+W to close, drag to reorder. Each tab has its own editor state, AI chat history, pending edits, and undo/redo stack, all persisted locally.
- **Local-only** — API keys live in the Tauri store on disk, never in cloud config. AI requests go directly from the app to the provider you choose.
- **Bidirectional mrkdwn** — serialiser + parser keep the document round-trippable so the AI edits the same surface the user edits.
- **Geist Variable** typeface throughout for a clean, modern feel.

## Architecture

```
src/
├── lib/
│   ├── slack/                 # mrkdwn ↔ TipTap, block derivation, validator
│   ├── ai/
│   │   ├── types.ts           # ChatMessage, ContentPart (vision), AiProvider interface
│   │   ├── providers/
│   │   │   └── openai.ts      # OpenAI, Anthropic, OpenRouter adapters (multi-modal)
│   │   ├── systemPrompt.ts    # Slack-aware system prompt + context builder
│   │   ├── parseEditResponse.ts
│   │   └── applyEdits.ts
│   └── utils.ts
├── features/
│   ├── editor/                # SlackEditor + toolbar (image file picker) + custom nodes
│   ├── ai/                    # AiChatPanel (image paste, vision, apply-to-editor) + PendingEditCard
│   ├── copy/                  # Copy-to-Slack pipeline (TipTap → mrkdwn → Quill Delta → Rust)
│   └── settings/              # Provider + API key modal
├── components/
│   ├── EditorTabs.tsx         # Multi-tab strip with drag-to-reorder, Cmd+T/W shortcuts
│   └── ResizableSplitPane.tsx
├── store/
│   ├── appStore.ts            # Zustand store — per-tab conversation state, undo/redo
│   ├── persistence.ts         # Autosave + hydrate
│   └── streamControllers.ts
└── App.tsx
src-tauri/
└── src/clipboard.rs           # `copy_slack_message` / `read_slack_clipboard` Rust commands
```

The editor's TipTap JSON document is the single source of truth per tab. `content` (Slack mrkdwn) and `blocks` (high-level block list with stable ids) are derived on the fly for the AI context and Copy-to-Slack pipeline.

## Slack mrkdwn rules followed

Per [docs.slack.dev/messaging/formatting-message-text](https://docs.slack.dev/messaging/formatting-message-text):

| Mark | Slack mrkdwn |
|------|--------------|
| Bold | `*bold*` (single asterisks) |
| Italic | `_italic_` (single underscores) |
| Strikethrough | `~strike~` (single tildes) |
| Inline code | `` `code` `` (no nested formatting) |
| Code block | ``` ```code``` ``` |
| Block quote | `> line` (prefixed each line) |
| Link | `<url>` or `<url|label>` (never `[label](url)`) |
| Escape | `&` `<` `>` → `&amp;` `&lt;` `&gt;` |

The system prompt enforces these rules, and `validateMrkdwn` auto-fixes the most common AI mistakes (`**bold**`, `~~strike~~`, `[label](url)`, ATX headings) before applying edits.

## Running

Prerequisites: Node 18+, Rust stable, platform-specific Tauri prerequisites — see [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev          # launch the desktop app
npm run test               # vitest unit tests
cd src-tauri && cargo test # Rust clipboard tests
```

To build a packaged binary:

```bash
npm run tauri build
```

## AI provider setup

Open the settings modal (gear icon in the AI panel) and paste an API key for one of:

- **OpenAI** — `https://api.openai.com/v1` · default model `gpt-4o-mini` (vision capable)
- **Anthropic** — `https://api.anthropic.com/v1` · default model `claude-sonnet-4-6` (vision capable)
- **OpenRouter** — `https://openrouter.ai/api/v1` · default model `anthropic/claude-3.5-sonnet`

The Anthropic adapter sets `anthropic-dangerous-direct-browser-access: true` so requests work from inside Tauri's webview without a proxy.

### Vision / image support

Paste any image directly into the AI chat textarea (or use Cmd+V). A thumbnail preview appears; when you send, the image is included in the API call as a base64 vision content block. Works with all providers that support the OpenAI vision format or Anthropic's multimodal API.

## Copy-to-Slack pipeline

1. TipTap document is serialised to Slack mrkdwn via `tipTapToMrkdwn`.
2. Mrkdwn is converted to a Quill Delta JSON string by `@slackfmt/core`'s `markdownToDelta`.
3. The Rust `copy_slack_message` command writes two clipboard entries:
   - plain text (the mrkdwn fallback)
   - `org.chromium.web-custom-data` containing a Pickle-encoded `slack/texty` blob
4. When you paste into Slack desktop, the Quill composer reads the custom data and reconstructs your formatting exactly.

If the Tauri command isn't available (e.g. running the Vite dev server in a regular browser), the app falls back to writing plain mrkdwn via `navigator.clipboard`.

## Testing

- `src/lib/slack/*.test.ts` — serialiser round-trips, validator rules, block derivation.
- `src/lib/ai/*.test.ts` — response parser, structured edit applier.
- `src-tauri/src/clipboard.rs` (`#[cfg(test)]`) — Chromium Pickle encode/decode round-trip.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl+T | New tab (auto-focuses AI prompt) |
| Cmd/Ctrl+W | Close current tab |
| Cmd/Ctrl+1–9 | Switch to tab N |
| Cmd/Ctrl+Shift+C | Copy to Slack |
| Enter | Send AI message |
| Shift+Enter | Newline in AI message |

## Limitations / future work

- Images dropped as local files are encoded as `data:` URLs. Slack accepts these in the Quill delta, but for large media a proper upload step is preferable.
- `read_slack_clipboard` is implemented in Rust but not yet exposed in the UI (paste-from-Slack flow).
- OpenRouter does not forward vision requests to all models — pick a vision-capable model explicitly (e.g. `openai/gpt-4o`).
