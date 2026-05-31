# Slackbuilder
<p align="center">
  <img src="docs/assets/logo_animated.webp" alt="Slackbuilder logo animation" width="75%" />
</p>

**An AI-powered WYSIWYG for Slack messages** — draft and refine in a Slack-faithful editor, then **Copy to Slack** so paste into the Slack desktop app keeps formatting exactly.

Slackbuilder is a local **Tauri 2** desktop app. The center of the product is the editor: what you see is what you get. The AI panel is a pair-writer that proposes structured edits you accept, reject, or tweak. When the message is ready, one click (or **Cmd/Ctrl+Shift+C**) copies native Slack clipboard data — not plain text — so your team gets bold, lists, code, links, and images as intended.

## How it works

1. **Write in the WYSIWYG** — TipTap surface styled like Slack: bold, italic, lists, quotes, code blocks, links, images.
2. **Refine with AI** — describe changes in natural language; the model returns structured edits (insert, replace, move, delete) you review before applying. **Ask mode** answers questions about the draft without touching the editor.
3. **Copy to Slack** — toolbar button or shortcut writes `slack/texty` via Rust so Slack desktop reconstructs formatting on paste.

## Why Slackbuilder

| You want… | Slackbuilder gives you… |
| --------- | ------------------------ |
| A real editor, not a chat box | Slack-faithful WYSIWYG with undo/redo per tab |
| AI that changes the message | Structured edits with per-change accept/reject |
| Paste that “just works” in Slack | Native `slack/texty` clipboard (Tauri), not lossy mrkdwn copy |
| Control before send | Review pending edits; apply with checkboxes or phrases like `go` / `apply` |
| Your keys stay local | API keys in Tauri store; requests go straight to your provider |

## Features

### WYSIWYG editor (primary surface)

- TipTap document is the source of truth per tab; mrkdwn and block ids are derived for AI and copy.
- Slack-specific marks, lists, code blocks, block quotes, link unfurls, and resizable images.
- Multi-tab projects: **Cmd/Ctrl+T** new tab, **Cmd/Ctrl+W** close, drag reorder; each tab has its own editor, AI history, pending edits, and undo stack (persisted locally).
- Bidirectional mrkdwn serialise/parse so AI and human edits share one surface.

### Copy to Slack (primary action)

- **Toolbar** — Copy button with visible **Copied!** / error feedback.
- **Shortcut** — **Cmd/Ctrl+Shift+C**.
- **Pipeline** — TipTap → Slack mrkdwn → Quill Delta → Rust `copy_slack_message` writes plain text plus Chromium `org.chromium.web-custom-data` (`slack/texty` Pickle).
- **Fallback** — without Tauri (browser-only dev), copies mrkdwn plain text to the system clipboard.

### AI pair-writer

- Streaming **OpenAI**, **Anthropic**, and **OpenRouter** from the prompt footer model picker (vision / reasoning / web-search capability icons with tooltips).
- **Edit mode** (default) — model proposes structured edits against live editor content and block ids (`text-1`, `code-1`, …); supports **move** for reordering blocks without fragile delete+insert.
- **Ask mode** — chat about the current message without applying edits; assistant replies render as markdown.
- **Web search** — globe toggle (OpenAI Responses API, Anthropic `web_search`, OpenRouter `openrouter:web_search`).
- **Vision** — paste or attach images when the selected model supports vision; content is woven into the message via edits, not only chat.
- **Natural-language apply** — `go`, `apply`, `yes`, `put it in the editor`, etc. (whole message only) accept pending edits.
- **Cancel** — Stop restores your prompt to the input box and drops the in-flight turn (no “cancelled” bubble).
- Slack-aware system prompt + `validateMrkdwn` fixes common model mistakes (`**bold**`, markdown links, ATX headings) before apply.

### Settings & privacy

- **Settings** — provider, API key, light/dark theme. Model choice lives in the AI panel picker, not Settings.
- **Local-only** — keys on disk via Tauri store; no backend proxy (Anthropic uses `anthropic-dangerous-direct-browser-access` for webview requests).

## AI setup

1. Open **Settings** (gear in the AI panel) and add an API key for at least one provider.
2. Pick **provider + model** from the dropdown in the chat footer (grouped presets across providers).

| Provider   | Default base URL               | Default model                 |
| ---------- | ------------------------------ | ----------------------------- |
| OpenAI     | `https://api.openai.com/v1`    | `gpt-4o-mini`                 |
| Anthropic  | `https://api.anthropic.com/v1` | `claude-sonnet-4-6`           |
| OpenRouter | `https://openrouter.ai/api/v1` | `anthropic/claude-3.5-sonnet` |

**Vision:** paste an image into the chat (Cmd+V). Thumbnail preview; on send, vision-capable models receive base64 image content.

**Web search:** globe icon in the AI footer — current information from the web (provider-specific; may incur extra usage).

**Ask vs edit:** message-bubble toggle (left of model picker) — ask for explanations; pencil for editor changes.

**Apply pending edits:** checkboxes per edit, or a short apply phrase as the entire user message (`go`, `apply`, `yes`, …).

## Copy to Slack (technical)

1. `tipTapToMrkdwn` — document → Slack mrkdwn string.
2. `@slackfmt/core` `markdownToDelta` — mrkdwn → Quill Delta.
3. `copy_slack_message` (Rust) — plain UTF-8 + Pickle payload Slack desktop reads.
4. Paste in **Slack desktop** — formatting preserved.

Implementation: `src/features/copy/copyToSlack.ts`, `src-tauri/src/clipboard.rs`.

## Architecture

```
src/
├── features/
│   ├── editor/          # SlackEditor, toolbar, Slack nodes
│   ├── copy/            # Copy-to-Slack pipeline
│   ├── ai/              # AiChatPanel, pending edits, markdown chat
│   └── settings/        # API keys, provider, theme
├── lib/
│   ├── slack/           # mrkdwn ↔ TipTap, blocks, validator
│   └── ai/              # providers, prompt, parse/apply edits
├── store/               # tabs, streaming, persistence, undo
└── App.tsx
src-tauri/
└── src/clipboard.rs     # slack/texty read/write
```

Per tab: TipTap JSON → derived `content` (mrkdwn) + `blocks` (stable ids) for AI context and copy.

## Slack mrkdwn reference

Per [Slack formatting docs](https://docs.slack.dev/messaging/formatting-message-text):

| Mark          | Slack mrkdwn              |
| ------------- | ------------------------- |
| Bold          | `*bold*`                  |
| Italic        | `_italic_`                |
| Strikethrough | `~strike~`                |
| Inline code   | `` `code` ``              |
| Code block    | ` ```code``` `            |
| Block quote   | `> line`                  |
| Link          | `<url>` or `<url\|label>` |
| Escape        | `&` `<` `>` → entities    |

## Running

**Prerequisites:** Node 18+, Rust stable, [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
npm install
npm run tauri dev          # desktop app (recommended)
```

Release:

```bash
npm test
npm run build
npm run tauri build
# macOS DMG: src-tauri/target/release/bundle/dmg/
```

For a tagged release, verify the generated app, commit the versioned changes, tag
`v1.0.0`, push the branch and tag, then attach the DMG to a GitHub release.

## Keyboard shortcuts

| Shortcut         | Action                      |
| ---------------- | --------------------------- |
| Cmd/Ctrl+Shift+C | **Copy to Slack**           |
| Cmd/Ctrl+T       | New tab (focuses AI prompt) |
| Cmd/Ctrl+W       | Close current tab           |
| Cmd/Ctrl+1–9     | Switch to tab N             |
| Enter            | Send AI message             |
| Shift+Enter      | Newline in AI input           |

## Contributors

This repo is purely a side project maintained by a few friends: 

| GitHub Name | State, Name           | Role       |
| ----------- | -------------- | ---------- |
| Angusc415   | (QLD) Angus Chou     | Full stack |
| psilde      | (WA) Paul Silver    | Full stack |
| chaubenn    | (QLD) Benjamin Chau  | Full stack |
