use std::collections::HashMap;
use std::sync::Mutex;

use futures_util::StreamExt;
use tauri::ipc::Channel;
use tauri::State;
use tokio::sync::oneshot;

#[derive(serde::Deserialize, Debug)]
pub struct ProxyRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(serde::Serialize, Debug)]
pub struct ProxyResponse {
    pub status: u16,
    pub body: String,
}

#[derive(serde::Deserialize, Debug)]
pub struct StreamRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub abort_id: String,
}

#[derive(Clone, serde::Serialize, Debug)]
#[serde(untagged)]
pub enum StreamChunk {
    Text(String),
    Done { done: bool },
    Error { error: String },
}

#[derive(Default)]
pub struct StreamState(pub Mutex<HashMap<String, oneshot::Sender<()>>>);

#[tauri::command]
pub async fn proxy(request: ProxyRequest) -> Result<ProxyResponse, String> {
    let client = reqwest::Client::new();
    let method = request
        .method
        .parse::<reqwest::Method>()
        .map_err(|error| error.to_string())?;

    let mut builder = client.request(method, &request.url);

    for (key, value) in request.headers {
        builder = builder.header(key, value);
    }

    if let Some(body) = request.body {
        builder = builder.body(body);
    }

    let response = builder.send().await.map_err(|error| error.to_string())?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(|error| error.to_string())?;

    Ok(ProxyResponse { status, body })
}

#[tauri::command]
pub async fn proxy_stream(
    request: StreamRequest,
    channel: Channel<StreamChunk>,
    state: State<'_, StreamState>,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let method = request
        .method
        .parse::<reqwest::Method>()
        .map_err(|error| error.to_string())?;

    let mut builder = client.request(method, &request.url);

    for (key, value) in request.headers {
        builder = builder.header(key, value);
    }

    if let Some(body) = request.body {
        builder = builder.body(body);
    }

    let response = builder.send().await.map_err(|error| error.to_string())?;
    let status = response.status();

    if !status.is_success() {
        let body_text = response.text().await.unwrap_or_default();
        let _ = channel.send(StreamChunk::Error {
            error: format!("HTTP {}: {}", status, body_text),
        });
        return Ok(());
    }

    let abort_id = request.abort_id.clone();
    let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();

    {
        let mut handles = state.0.lock().map_err(|error| error.to_string())?;
        handles.insert(abort_id, cancel_tx);
    }

    let mut byte_stream = response.bytes_stream();

    loop {
        tokio::select! {
            biased;

            _ = &mut cancel_rx => {
                // Cancellation requested by the webview. Dropping byte_stream
                // cancels the underlying reqwest response body.
                let _ = channel.send(StreamChunk::Done { done: true });
                break;
            }

            chunk_result = byte_stream.next() => {
                match chunk_result {
                    Some(Ok(bytes)) => {
                        let text = String::from_utf8_lossy(&bytes);
                        if channel.send(StreamChunk::Text(text.to_string())).is_err() {
                            // Channel dropped by the webview; stop streaming.
                            break;
                        }
                    }
                    Some(Err(error)) => {
                        let _ = channel.send(StreamChunk::Error {
                            error: error.to_string(),
                        });
                        break;
                    }
                    None => {
                        let _ = channel.send(StreamChunk::Done { done: true });
                        break;
                    }
                }
            }
        }
    }

    {
        let mut handles = state.0.lock().map_err(|error| error.to_string())?;
        handles.remove(&request.abort_id);
    }

    Ok(())
}

#[tauri::command]
pub fn abort_stream(abort_id: String, state: State<'_, StreamState>) -> Result<(), String> {
    let mut handles = state.0.lock().map_err(|error| error.to_string())?;
    if let Some(sender) = handles.remove(&abort_id) {
        let _ = sender.send(());
    }
    Ok(())
}
