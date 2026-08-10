use std::panic;

// pdf-extract has known panics on malformed input (see jrmuizel/pdf-extract
// issues), so the call is wrapped in catch_unwind and this cap keeps a huge
// file from tying up the command for long. Both turn a bad PDF into a
// regular error instead of taking down the app.
const MAX_PDF_BYTES: usize = 20 * 1024 * 1024;

#[tauri::command]
pub fn extract_pdf_text(bytes: Vec<u8>) -> Result<String, String> {
    if bytes.len() > MAX_PDF_BYTES {
        return Err(format!(
            "PDF is too large to read ({} MB, limit {} MB)",
            bytes.len() / (1024 * 1024),
            MAX_PDF_BYTES / (1024 * 1024)
        ));
    }

    let extracted = panic::catch_unwind(|| pdf_extract::extract_text_from_mem(&bytes))
        .map_err(|_| "Failed to read PDF: the file appears to be corrupted or unsupported".to_string())?;

    extracted.map_err(|error| format!("Failed to read PDF: {error}"))
}
