use std::panic;

use pdf_inspector::{PdfError, process_pdf_mem};

// pdf-inspector parses untrusted input with lopdf, which can panic on
// malformed files, so the call is wrapped in catch_unwind and this cap keeps
// a huge file from tying up the command for long. Both turn a bad PDF into a
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

    let processed = panic::catch_unwind(panic::AssertUnwindSafe(|| process_pdf_mem(&bytes)))
        .map_err(|_| "Failed to read PDF: the file appears to be corrupted or unsupported".to_string())?;

    let result = processed.map_err(|error| match error {
        PdfError::Encrypted => {
            "This PDF is password-protected. Remove the password to read it.".to_string()
        }
        other => format!("Failed to read PDF: {other}"),
    })?;

    match result.markdown {
        Some(markdown) if !markdown.trim().is_empty() => Ok(markdown),
        _ => Err(format!(
            "This PDF appears to be scanned (type: {:?}, {} pages, {} needing OCR). Text extraction returned no content.",
            result.pdf_type,
            result.page_count,
            result.pages_needing_ocr.len()
        )),
    }
}
