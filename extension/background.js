// Maintain per-tab analysis results and set badge

const tabResults = new Map();

async function callBackendAnalyze(text) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch("http://127.0.0.1:5000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (e) {
    console.error("Analyze via 127.0.0.1 failed:", e && e.message ? e.message : e);
    try {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 8000);
      const resp2 = await fetch("http://localhost:5000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller2.signal
      });
      clearTimeout(timeout2);
      if (!resp2.ok) throw new Error(`HTTP ${resp2.status}`);
      return await resp2.json();
    } catch (e2) {
      console.error("Analyze via localhost failed:", e2 && e2.message ? e2.message : e2);
      return { error: e2 && e2.message ? e2.message : String(e2) };
    }
  }
}

function setBadgeForTab(tabId, result) {
  if (!chrome.action || typeof chrome.action.setBadgeText !== "function") return;
  const isToxic = result && typeof result.status === "string" && result.status.includes("Toxic");
  chrome.action.setBadgeText({ tabId, text: isToxic ? "⚠" : "" });
  if (isToxic) {
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#d9534f" });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "PAGE_ANALYSIS_RESULT") {
    const tabId = sender && sender.tab ? sender.tab.id : undefined;
    if (tabId !== undefined) {
      tabResults.set(tabId, msg.payload);
      setBadgeForTab(tabId, msg.payload);
    }
    sendResponse && sendResponse({ ok: true });
    return; // non-async path
  }
});

// Serve latest result to popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "GET_LATEST_RESULT_FOR_ACTIVE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      const result = tab ? tabResults.get(tab.id) : undefined;
      sendResponse({ ok: true, result });
    });
    return true; // async
  }
});

// Accept raw text from content script and analyze from background (avoids mixed-content issues)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "REQUEST_BACKGROUND_ANALYZE" && typeof msg.text === "string") {
    const tabId = sender && sender.tab ? sender.tab.id : undefined;
    (async () => {
      const result = await callBackendAnalyze(msg.text);
      if (tabId !== undefined && result && !result.error) {
        tabResults.set(tabId, result);
        setBadgeForTab(tabId, result);
      }
      sendResponse({ ok: !result.error, result });
    })();
    return true; // async
  }
});

// Clean up when tab removed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabResults.delete(tabId);
});

