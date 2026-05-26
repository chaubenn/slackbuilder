// Slack-native clipboard writer.
//
// Slack's desktop composer is a Quill editor that reads a custom payload from
// the system clipboard. Rich paste fidelity comes from writing the
// `org.chromium.web-custom-data` MIME entry containing a Chromium Pickle-encoded
// `slack/texty` value. The Pickle layout is ported from cauethenorio/slackfmt.

use clipboard_rs::{Clipboard, ClipboardContent, ClipboardContext};
use serde::{Deserialize, Serialize};

const CHROMIUM_CUSTOM_DATA: &str = "org.chromium.web-custom-data";
const SLACK_TEXTY: &str = "slack/texty";

#[derive(Serialize, Deserialize)]
pub struct SlackClipboardPayload {
    pub plain_text: Option<String>,
    pub delta_text: Option<String>,
}

#[tauri::command]
pub fn copy_slack_message(plain_text: String, delta_text: String) -> Result<(), String> {
    let ctx = ClipboardContext::new()
        .map_err(|e| format!("Failed to create clipboard context: {}", e))?;

    let pickle = encode_chromium_pickle(SLACK_TEXTY, &delta_text);

    ctx.set(vec![
        ClipboardContent::Text(plain_text),
        ClipboardContent::Other(CHROMIUM_CUSTOM_DATA.to_string(), pickle),
    ])
    .map_err(|e| format!("Failed to write to clipboard: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn read_slack_clipboard() -> Result<SlackClipboardPayload, String> {
    let ctx = ClipboardContext::new()
        .map_err(|e| format!("Failed to create clipboard context: {}", e))?;

    let plain_text = ctx.get_text().ok();

    let delta_text = ctx
        .get_buffer(CHROMIUM_CUSTOM_DATA)
        .ok()
        .and_then(|data| decode_chromium_pickle(&data))
        .and_then(|entries| {
            entries
                .into_iter()
                .find(|(t, _)| t == SLACK_TEXTY)
                .map(|(_, v)| v)
        });

    Ok(SlackClipboardPayload {
        plain_text,
        delta_text,
    })
}

// ── Chromium Pickle encoding ──────────────────────────────

fn encode_chromium_pickle(mime_type: &str, value: &str) -> Vec<u8> {
    let mut payload = Vec::new();

    payload.extend_from_slice(&1u32.to_le_bytes());

    pickle_string(&mut payload, mime_type);
    pickle_string(&mut payload, value);

    let mut result = Vec::with_capacity(4 + payload.len());
    result.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    result.extend(payload);

    result
}

fn pickle_string(buf: &mut Vec<u8>, s: &str) {
    let utf16: Vec<u16> = s.encode_utf16().collect();
    buf.extend_from_slice(&(utf16.len() as u32).to_le_bytes());

    for code_unit in &utf16 {
        buf.extend_from_slice(&code_unit.to_le_bytes());
    }

    let byte_len = utf16.len() * 2;
    let padding = (4 - (byte_len % 4)) % 4;
    buf.extend(std::iter::repeat(0u8).take(padding));
}

// ── Chromium Pickle decoding ──────────────────────────────

fn decode_chromium_pickle(data: &[u8]) -> Option<Vec<(String, String)>> {
    if data.len() < 8 {
        return None;
    }

    let payload_size = u32::from_le_bytes(data[0..4].try_into().ok()?) as usize;
    let payload = data.get(4..4 + payload_size)?;

    let count = u32::from_le_bytes(payload.get(0..4)?.try_into().ok()?) as usize;
    let mut offset = 4;
    let mut entries = Vec::with_capacity(count);

    for _ in 0..count {
        let (type_name, next) = unpickle_string(payload, offset)?;
        let (value, next) = unpickle_string(payload, next)?;
        entries.push((type_name, value));
        offset = next;
    }

    Some(entries)
}

fn unpickle_string(data: &[u8], offset: usize) -> Option<(String, usize)> {
    let end = offset + 4;
    let char_count = u32::from_le_bytes(data.get(offset..end)?.try_into().ok()?) as usize;
    let byte_count = char_count * 2;
    let start = end;

    let utf16: Vec<u16> = (0..char_count)
        .map(|i| {
            let pos = start + i * 2;
            u16::from_le_bytes(data[pos..pos + 2].try_into().unwrap())
        })
        .collect();

    let s = String::from_utf16(&utf16).ok()?;
    let padding = (4 - (byte_count % 4)) % 4;
    Some((s, start + byte_count + padding))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_single_entry() {
        let pickle = encode_chromium_pickle("slack/texty", "{\"ops\":[{\"insert\":\"hi\"}]}");
        let decoded = decode_chromium_pickle(&pickle).expect("decodes");
        assert_eq!(decoded.len(), 1);
        assert_eq!(decoded[0].0, "slack/texty");
        assert_eq!(decoded[0].1, "{\"ops\":[{\"insert\":\"hi\"}]}");
    }

    #[test]
    fn pickle_string_alignment() {
        let mut buf = Vec::new();
        pickle_string(&mut buf, "ab");
        // 4 bytes count + 4 bytes utf16 ("ab" = 2 chars * 2 bytes) + 0 padding (aligned)
        assert_eq!(buf.len(), 8);

        let mut buf2 = Vec::new();
        pickle_string(&mut buf2, "a");
        // 4 bytes count + 2 bytes utf16 + 2 bytes padding
        assert_eq!(buf2.len(), 8);
    }
}
