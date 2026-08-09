use serde::{Deserialize, Serialize};
use tauri::{Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const POLL_INTERVAL_MS: u64 = 500;
const POLL_ATTEMPTS: u32 = 240; // 2 minutes
const EVAL_TIMEOUT_MS: u64 = 5000;
// Evals issued while the page is still loading are flushed by wry without
// their completion handler, so their callbacks never fire and the oneshot
// receiver errors immediately. Those failures are transient - keep polling
// through them, but abort if the webview stays unresponsive for this long.
const MAX_CONSECUTIVE_EVAL_FAILURES: u32 = 30;

#[derive(Serialize, Deserialize)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchPageInfo {
    pub title: String,
    pub url: String,
    pub scraped_count: usize,
    #[serde(default)]
    pub page_text: String,
}

#[derive(Serialize, Deserialize)]
pub struct SearchOutput {
    pub results: Vec<SearchResult>,
    pub page: SearchPageInfo,
}

#[derive(Deserialize)]
struct PollState {
    done: bool,
    results: Vec<SearchResult>,
    page: Option<SearchPageInfo>,
}

// Returns { done, results, page } once the user clicked the button. When no
// result links were scraped, page.pageText carries the visible page text so
// the caller still learns what the page actually showed.
const POLL_SCRIPT: &str = r#"
(() => {
  try {
    const results = window.__paResults;
    if (!Array.isArray(results)) return { done: false, results: [], page: null };
    return {
      done: true,
      results,
      page: {
        title: document.title,
        url: location.href,
        scrapedCount: results.length,
        pageText:
          results.length === 0 && document.body
            ? document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 4000)
            : "",
      },
    };
  } catch (e) {
    return { done: false, results: [], page: null, error: String(e) };
  }
})()
"#;

/// Opens (or reuses) a dedicated webview window pointed at a search URL, with
/// the given "Done" button script installed. The user performs the search
/// manually and clicks the button when finished.
pub fn open_search_window(
    app: &tauri::AppHandle,
    label: &str,
    title: &str,
    url: Url,
    init_script: &str,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(label) {
        window.navigate(url).map_err(|e| e.to_string())?;
        let _ = window.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(app, label, WebviewUrl::External(url))
        .title(title)
        .inner_size(980.0, 760.0)
        .initialization_script(init_script)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Waits until the user clicks the "Done" button in the search window, then
/// returns the scraped results and closes the window. Times out after 2
/// minutes. Transient eval failures (e.g. while the page is still loading) are
/// tolerated and the polling continues.
pub async fn poll_for_results(
    app: &tauri::AppHandle,
    label: &str,
) -> Result<SearchOutput, String> {
    let mut consecutive_failures: u32 = 0;

    for _ in 0..POLL_ATTEMPTS {
        let Some(window) = app.get_webview_window(label) else {
            return Err(
                "The search window was closed before the results could be collected. Try again."
                    .into(),
            );
        };

        match eval_json(&window, POLL_SCRIPT).await {
            Ok(json) => match serde_json::from_str::<PollState>(&json) {
                Ok(state) if state.done => {
                    let _ = window.close();
                    return Ok(SearchOutput {
                        results: state.results,
                        page: state.page.unwrap_or_default(),
                    });
                }
                Ok(_) => {
                    consecutive_failures = 0;
                }
                Err(_) => {
                    consecutive_failures += 1;
                }
            },
            Err(_) => {
                consecutive_failures += 1;
            }
        }

        if consecutive_failures >= MAX_CONSECUTIVE_EVAL_FAILURES {
            return Err("The search window stopped responding. Ask the user to try again.".into());
        }

        tokio::time::sleep(std::time::Duration::from_millis(POLL_INTERVAL_MS)).await;
    }

    Err(
        "Timed out waiting for the user to finish searching in the search window. \
         Ask the user to try again."
            .into(),
    )
}

/// Evaluates JS in the webview and resolves with the JSON-serialized result.
async fn eval_json(window: &WebviewWindow, script: &str) -> Result<String, String> {
    let (tx, rx) = tokio::sync::oneshot::channel::<String>();
    let tx = std::sync::Mutex::new(Some(tx));
    window
        .eval_with_callback(script.to_string(), move |json| {
            if let Some(tx) = tx.lock().ok().and_then(|mut guard| guard.take()) {
                let _ = tx.send(json);
            }
        })
        .map_err(|e| e.to_string())?;

    tokio::time::timeout(std::time::Duration::from_millis(EVAL_TIMEOUT_MS), rx)
        .await
        .map_err(|_| "Timed out waiting for the webview to respond".to_string())?
        .map_err(|e| e.to_string())
}
