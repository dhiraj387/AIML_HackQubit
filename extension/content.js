// Extract visible text from body
function getVisibleText() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
            if (!node.parentElement || node.parentElement.tagName === 'SCRIPT' || node.parentElement.tagName === 'STYLE') {
                return NodeFilter.FILTER_REJECT;
            }
            if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });
    
    let text = "";
    let node;
    while(node = walker.nextNode()) {
        text += " " + node.textContent.trim();
    }
    return text.trim();
}

// Send message to popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if(request.action === "getPageText") {
        const text = getVisibleText();
        sendResponse({text: text});
    }
});
