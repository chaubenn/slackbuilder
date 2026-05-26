# Slackbuilder

An AI-powered Slack message composer that runs as a local Tauri 2 desktop app. The editor is a WYSIWYG surface styled like Slack, and a second panel runs a Cursor-style AI loop that proposes structured edits you can accept, reject, or partially apply. "Copy to Slack" uses Slack's native clipboard format so pastes into the Slack desktop client preserve formatting exactly.

## Highlights

- **Slack-faithful WYSIWYG editor** built on TipTap with Slack-specific marks, lists, code blocks, block quotes, link unfurls, and image blocks.
- **Native `slack/texty` clipboard** via a small Rust command that writes a Chromium Pickle payload, so Slack desktop reads pasted formatting losslessly.
- **AI pair-writer panel** with streaming OpenAI / Anthropic / OpenRouter providers, a Slack-aware system prompt, and a structured edit protocol with per-edit accept/reject.
- **Local-only** — API keys live in the Tauri store on disk, never in cloud config. AI requests go directly from the app to the provider you choose.
- **Bidirectional mrkdwn**: serializer + parser keep the document round-trippable so the AI can edit the same surface the user edits.

## Architecture

```
src/
├── lib/
│   ├── slack/                 # mrkdwn ↔ TipTap, block derivation, validator
│   ├── ai/                    # provider adapters, system prompt, edit protocol
│   └── utils.ts
├── features/
│   ├── editor/                # SlackEditor + toolbar + custom nodes
│   ├── ai/                    # chat panel + pending edit card
│   ├── copy/                  # Copy-to-Slack pipeline (TipTap → mrkdwn → Quill Delta → Rust)
│   └── settings/              # provider + API key modal
├── store/                     # Zustand store + autosave/hydrate
└── App.tsx
src-tauri/
└── src/clipboard.rs           # `copy_slack_message` / `read_slack_clipboard` Rust commands
```

The editor's TipTap JSON document is the single source of truth. `content` (Slack mrkdwn) and `blocks` (high-level block list with stable ids) are derived on the fly for the AI context and Copy-to-Slack pipeline.

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

Open the settings modal in the app (gear icon in the AI panel) and paste an API key for one of:

- OpenAI (`https://api.openai.com/v1`)
- Anthropic (`https://api.anthropic.com/v1`)
- OpenRouter (`https://openrouter.ai/api/v1`)

The Anthropic adapter sets `anthropic-dangerous-direct-browser-access: true` so the request works from inside Tauri's webview without a proxy.

## Copy-to-Slack pipeline

1. TipTap document is serialized to Slack mrkdwn via `tipTapToMrkdwn`.
2. Mrkdwn is converted to a Quill Delta JSON string by `@slackfmt/core`'s `markdownToDelta`.
3. The Rust `copy_slack_message` command writes two clipboard entries:
   - plain text (the mrkdwn fallback)
   - `org.chromium.web-custom-data` containing a Pickle-encoded `slack/texty` blob
4. When you paste into Slack desktop, the Quill composer reads the custom data and reconstructs your formatting exactly.

If the Tauri command isn't available (e.g. running the Vite dev server in a regular browser), the app falls back to writing plain mrkdwn via `navigator.clipboard`.

## Testing

- `src/lib/slack/*.test.ts` — serializer round-trips, validator rules, block derivation.
- `src/lib/ai/*.test.ts` — response parser, structured edit applier.
- `src-tauri/src/clipboard.rs` (`#[cfg(test)]`) — Chromium Pickle encode/decode round-trip.

## Limitations / future work

- Images dropped as local files are encoded as `data:` URLs. Slack accepts these in the Quill delta, but for large media you may want a proper upload step.
- Anthropic provider is wired but their browser-direct mode requires `anthropic-dangerous-direct-browser-access`. For a public release, route through Tauri's HTTP plugin or a tiny proxy.
- `read_slack_clipboard` is implemented in Rust but not yet exposed in the UI (paste-from-Slack flow).
