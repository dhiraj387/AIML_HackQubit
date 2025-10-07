// Extract visible text from page with better filtering
function getVisibleText() {
    const walker = document.createTreeWalker(
        document.body, 
        NodeFilter.SHOW_TEXT, 
        {
            acceptNode: function(node) {
                // Skip script and style tags
                if (!node.parentElement || 
                    node.parentElement.tagName === 'SCRIPT' || 
                    node.parentElement.tagName === 'STYLE' ||
                    node.parentElement.tagName === 'NOSCRIPT') {
                    return NodeFilter.FILTER_REJECT;
                }
                
                // Skip empty text
                if (!node.textContent.trim()) {
                    return NodeFilter.FILTER_REJECT;
                }
                
                // Skip very short text nodes (likely formatting)
                if (node.textContent.trim().length < 3) {
                    return NodeFilter.FILTER_REJECT;
                }
                
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );
    
    let textParts = [];
    let node;
    
    while(node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (text.length > 2) {
            textParts.push(text);
        }
    }
    
    // Join with spaces and limit length
    const fullText = textParts.join(' ').trim();
    
    // Prioritize comments and user-generated content
    const prioritySelectors = [
        '.comment', '.comments',
        '[data-testid*="comment"]',
        '.review', '.reviews',
        '.post-content', '.post-body',
        '.message', '.messages',
        '.chat', '.discussion',
        '.user-content', '.ugc',
        'article', '.article',
        '.content', '.main-content'
    ];
    
    let priorityContent = '';
    for (const selector of prioritySelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            const text = element.textContent?.trim();
            if (text && text.length > 10) {
                priorityContent += ' ' + text;
            }
        }
    }
    
    // Return priority content if found, otherwise full text
    const result = priorityContent.trim() || fullText;
    
    // Limit to reasonable size (first 2000 characters)
    return result.substring(0, 2000);
}

// Get page metadata for better context
function getPageInfo() {
    return {
        title: document.title,
        url: window.location.href,
        domain: window.location.hostname
    };
}

// Send message to popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if(request.action === "getPageText") {
        const text = getVisibleText();
        const pageInfo = getPageInfo();
        
        console.log('Content script extracted text:', {
            textLength: text.length,
            preview: text.substring(0, 100) + '...',
            pageInfo: pageInfo
        });
        
        sendResponse({
            text: text,
            pageInfo: pageInfo
        });
    }
    return true; // Keep message channel open for async response
});
