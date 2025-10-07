const resultEl = document.getElementById("result");
const urlEl = document.getElementById("currentUrl");
const reanalyzeBtn = document.getElementById("reanalyzeBtn");

function setResult(result) {
  if (!result) {
    resultEl.innerText = "No analysis yet for this tab.";
    return;
  }
  resultEl.innerText = `${result.status}\nLabel: ${result.label}\nConfidence: ${result.confidence}%`;
}

function setUrl() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (tab && tab.url) urlEl.textContent = tab.url;
  });
}

function loadLatest() {
  resultEl.innerText = "⏳ Loading...";
  chrome.runtime.sendMessage({ type: "GET_LATEST_RESULT_FOR_ACTIVE_TAB" }, (resp) => {
    setResult(resp && resp.result);
  });
}

reanalyzeBtn.addEventListener("click", () => {
  resultEl.innerText = "⏳ Re-analyzing...";
  // Ask content script to analyze now
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs && tabs[0] && tabs[0].id;
    if (!tabId) return;
    chrome.tabs.sendMessage(tabId, { type: "REQUEST_ANALYZE_NOW" }, (res) => {
      if (res && res.result) setResult(res.result);
      else if (res && res.ok === false && res.result && res.result.error) {
        resultEl.innerText = `❌ Backend error: ${res.result.error}`;
      } else {
        loadLatest();
      }
    });
  });
});

setUrl();
loadLatest();
