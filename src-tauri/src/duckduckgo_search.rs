use crate::search_window::{self, SearchOutput};
use tauri::Url;

const WINDOW_LABEL: &str = "duckduckgo-search";
const WINDOW_TITLE: &str = "DuckDuckGo Search";

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

  const scrape = () => {
    const results = [];
    const seen = new Set();
    // DuckDuckGo sometimes exposes /l/?uddg=<encoded> redirect links instead
    // of the real destination. Decode them so fetchUrl gets the actual page.
    const cleanUrl = (href) => {
      try {
        const u = new URL(href);
        if (u.hostname.endsWith("duckduckgo.com") && u.pathname === "/l/") {
          const uddg = u.searchParams.get("uddg");
          if (uddg) return uddg;
        }
        return href;
      } catch (e) {
        return href;
      }
    };
    const push = (title, url, snippet) => {
      if (!title || !url || !/^https?:/.test(url) || seen.has(url)) return;
      seen.add(url);
      const clean = (snippet || "").replace(/\s+/g, " ").trim();
      results.push({ title: title.trim(), url, snippet: clean.slice(0, 400) });
    };

    // Primary: DuckDuckGo's classic html layout (.result blocks).
    document.querySelectorAll(".result").forEach((el) => {
      const a = el.querySelector(".result__a");
      if (!a) return;
      push(a.textContent, cleanUrl(a.href), el.querySelector(".result__snippet")?.textContent);
    });

    // Fallback: any link with a heading in case the layout changes.
    if (results.length === 0) {
      document.querySelectorAll("a").forEach((a) => {
        const h = a.querySelector("h2, h3");
        if (h) push(h.textContent, cleanUrl(a.href), a.closest("div")?.textContent);
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
      "background:#de5833",
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
    let mut url = Url::parse("https://html.duckduckgo.com/html/").map_err(|e| e.to_string())?;
    url.query_pairs_mut().append_pair("q", query);
    Ok(url)
}

/// Opens (or reuses) a dedicated webview window showing DuckDuckGo search
/// results for the given query. The user performs the search manually and
/// clicks the injected "Done" button when finished.
#[tauri::command]
pub async fn duckduckgo_search(app: tauri::AppHandle, query: String) -> Result<(), String> {
    let url = build_search_url(&query)?;
    search_window::open_search_window(&app, WINDOW_LABEL, WINDOW_TITLE, url, INIT_SCRIPT)
}

/// Waits until the user clicks the "Done" button in the DuckDuckGo search
/// window, then returns the scraped results and closes the window.
#[tauri::command]
pub async fn collect_duckduckgo_results(app: tauri::AppHandle) -> Result<SearchOutput, String> {
    search_window::poll_for_results(&app, WINDOW_LABEL).await
}
