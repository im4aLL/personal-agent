use crate::search_window::{self, SearchOutput};
use tauri::Url;

const WINDOW_LABEL: &str = "google-search";
const WINDOW_TITLE: &str = "Google Search";

// Injected before the page loads. Tauri's initialization_script runs on every
// top-level navigation (it's a WKUserScript at document start), so the
// __paSearchInjected guard only prevents duplicate injection within the same
// document. Adds a floating "Done" button that scrapes the visible result
// links into a plain JS global (window.__paResults) - no localStorage, so no
// storage-permission failures - which search_window::poll_for_results reads
// back via eval_with_callback.
const INIT_SCRIPT: &str = r##"
if (!window.__paSearchInjected) {
  window.__paSearchInjected = true;

  const cleanSnippet = (el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll("a").forEach((a) => {
      if (a.querySelector("h3")) a.remove();
    });
    clone.querySelectorAll("cite, nav, button, script, style").forEach((n) => n.remove());
    return (clone.textContent || "").replace(/\s+/g, " ").trim();
  };

  // Google sometimes exposes /url?q=<encoded> redirect links instead of the
  // real destination. Decode them so fetchUrl gets the actual page.
  const cleanUrl = (href) => {
    try {
      const u = new URL(href);
      if (u.hostname === "www.google.com" && u.pathname === "/url") {
        const q = u.searchParams.get("q");
        if (q) return q;
      }
      return href;
    } catch (e) {
      return href;
    }
  };

  const scrape = () => {
    const results = [];
    const seen = new Set();
    const push = (title, url, snippet) => {
      if (!title || !url || !/^https?:/.test(url) || seen.has(url)) return;
      seen.add(url);
      results.push({ title: title.trim(), url, snippet: snippet.slice(0, 400) });
    };

    // Primary: result links inside Google's result containers.
    const containers = ["#search", "#rso", "#main"]
      .map((s) => document.querySelector(s))
      .filter(Boolean);
    const scopes = containers.length ? containers : [document];
    for (const scope of scopes) {
      scope.querySelectorAll("a").forEach((a) => {
        const h3 = a.querySelector("h3");
        if (!h3) return;
        const container = a.closest("div");
        push(h3.textContent, cleanUrl(a.href), container?.parentElement ? cleanSnippet(container.parentElement) : "");
      });
    }

    // Fallback: any link with an h3 anywhere in the page.
    if (results.length === 0) {
      document.querySelectorAll("a").forEach((a) => {
        const h3 = a.querySelector("h3");
        if (!h3) return;
        const container = a.closest("div");
        push(h3.textContent, cleanUrl(a.href), container ? cleanSnippet(container) : "");
      });
    }

    return results.slice(0, 10);
  };

  const injectButton = () => {
    if (document.getElementById("pa-done-btn")) return;
    const btn = document.createElement("button");
    btn.id = "pa-done-btn";
    btn.textContent = "Done - send results";
    btn.style.cssText = [
      "position:fixed",
      "bottom:16px",
      "right:16px",
      "z-index:2147483647",
      "padding:10px 18px",
      "border:none",
      "border-radius:8px",
      "background:#1a73e8",
      "color:#ffffff",
      "font:600 14px/1.2 system-ui,sans-serif",
      "cursor:pointer",
      "box-shadow:0 2px 8px rgba(0,0,0,0.25)",
    ].join(";");
    btn.onclick = () => {
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        window.__paResults = scrape();
        btn.textContent = "Sending...";
      } catch (e) {
        btn.textContent = "Failed - click to retry";
        btn.disabled = false;
      }
    };
    (document.body || document.documentElement).appendChild(btn);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectButton);
  } else {
    injectButton();
  }
}
"##;

fn build_search_url(query: &str) -> Result<Url, String> {
    let mut url = Url::parse("https://www.google.com/search").map_err(|e| e.to_string())?;
    url.query_pairs_mut().append_pair("q", query);
    Ok(url)
}

/// Opens (or reuses) a dedicated webview window showing Google search results
/// for the given query. The user performs the search manually (handling any
/// login or captcha) and clicks the injected "Done" button when finished.
#[tauri::command]
pub async fn google_search(app: tauri::AppHandle, query: String) -> Result<(), String> {
    let url = build_search_url(&query)?;
    search_window::open_search_window(&app, WINDOW_LABEL, WINDOW_TITLE, url, INIT_SCRIPT)
}

/// Waits until the user clicks the "Done" button in the Google search window,
/// then returns the scraped results and closes the window.
#[tauri::command]
pub async fn collect_google_results(app: tauri::AppHandle) -> Result<SearchOutput, String> {
    search_window::poll_for_results(&app, WINDOW_LABEL).await
}
