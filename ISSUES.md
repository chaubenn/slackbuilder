# Issues Board

A lightweight kanban for tracking work and managing Agile practises for SlackBuilder. 

Flow is someone fixes a ticket in Backlog -> Move ticket to QA -> Ping someone to QA -> QA person verifies then removes from QA to Done

## Backlog

### QA - local AI models 
- users should be able to use local models, ones that are free to use and run locally 
- if they can't, allow them to do so


## QA 

## Done 

### Improvement — model selector & settings modal
- Eye / brain / globe capability icons on the model picker (trigger + preset list) use hover tooltips (vision, reasoning, web search)
- Settings modal: removed Model and Base URL fields (provider + API key + theme only); model/base URL chosen via prompt-box model selector

### Improvement — tooltips & ask mode
- `HoverTooltip` on prompt-box footer controls (edit/ask, web search, attach image, hints, send/stop)
- Ask mode toggle: chat without forced editor edits; editor content still sent as context; `ASK_SYSTEM_PROMPT` + `parseAskResponse`; streaming shows live answer text
- Edit/ask toggle moved to the left of the model selector

### Bug — editing inaccuracies
- “Add to bottom / end” inserts now land at the document end (`normalizeEditPositions`; move intent excluded so “move to bottom” is not remapped)
- Accept-all no longer wipes the editor when the model returns `optionalFullRewrite` alongside multiple edits (`shouldUseOptionalFullRewrite`)
- Context includes `MRKDWN LENGTH` so the model knows document size; system prompt clarifies bottom vs top placement

### Bug — block IDs & move edits
- `tipTapToBlocks`: each top-level TipTap node is its own block (`text-1`, `code-1`, …) so deleting one block does not remove the whole message
- New edit type `move` (source `target` + `destination`); `applyMove` in `applyEdits`; shown on pending edit cards
- Replaces fragile delete+insert for “move code to bottom” style requests

### Improvement — chat rendering
- Assistant messages render markdown (`ChatMarkdown`) instead of raw `##` / `**` text

### Improvement — cancelling prompts
- Stop restores the prompt to the input box and removes the in-flight user/assistant messages (no “(cancelled)” bubble)
- `pendingStreamUserMessage` + `promptDraft`; abort path avoids double rollback
- Note: image-only sends restore empty text; attachments are not restored on cancel

### Improvement — copy to Slack button 
- Toolbar button shows Copied! / Copy failed with color + icon for ~2s (title bar status kept)

### Implement — web search 
- Globe toggle in the AI panel enables provider web search (OpenAI Responses API + `web_search`, Anthropic `web_search_20250305`, OpenRouter `openrouter:web_search`)
- OpenAI: no JSON mode when web search is on (API constraint)
- README updated for web search / ask mode where applicable
