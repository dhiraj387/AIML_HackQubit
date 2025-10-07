// Scrape visible text, send to backend, and store result per tab

async function extractVisibleText(maxLength = 4000) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.parentElement) return NodeFilter.FILTER_REJECT;
      const style = window.getComputedStyle(node.parentElement);
      const isHidden = style && (style.display === "none" || style.visibility === "hidden");
      if (isHidden) return NodeFilter.FILTER_REJECT;
      const text = node.nodeValue.trim();
      if (!text) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const chunks = [];
  let collected = 0;
  while (walker.nextNode()) {
    const t = walker.currentNode.nodeValue.replace(/\s+/g, " ").trim();
    if (!t) continue;
    if (collected + t.length > maxLength) {
      const remaining = Math.max(0, maxLength - collected);
      if (remaining > 0) {
        chunks.push(t.slice(0, remaining));
        collected += remaining;
      }
      break;
    } else {
      chunks.push(t);
      collected += t.length;
    }
  }
  return chunks.join(" ");
}

async function analyzePage() {
  try {
    const text = await extractVisibleText();
    if (!text || text.length < 20) return null;
    return await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "REQUEST_BACKGROUND_ANALYZE", text }, (resp) => {
        if (resp && resp.result) resolve(resp.result);
        else resolve(null);
      });
    });
  } catch (e) {
    return null;
  }
}

async function saveResultToStorage(result) {
  try {
    // Use a lightweight key; content scripts don't know tabId, so send to background
    chrome.runtime.sendMessage({ type: "PAGE_ANALYSIS_RESULT", payload: result });
  } catch (_) {}
}

// Analyze on initial load (debounced to let heavy pages settle)
let scheduled = setTimeout(async () => {
  const result = await analyzePage();
  if (result) await saveResultToStorage(result);
}, 1200);

// Listen for explicit requests from popup to re-analyze
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "REQUEST_ANALYZE_NOW") {
    analyzePage().then((result) => {
      if (result) saveResultToStorage(result);
      sendResponse({ ok: true, result });
    });
    return true; // async
  }
});
