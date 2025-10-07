const statusDiv = document.getElementById("status");
const scoreDiv = document.getElementById("score");

function analyzeText(text) {
    fetch(`http://127.0.0.1:8000/predict?text=${encodeURIComponent(text)}`)
        .then(response => response.json())
        .then(data => {
            let label = data.label;
            let confidence = (data.scores[label]*100).toFixed(2);
            
            statusDiv.textContent = `Result: ${label.toUpperCase()}`;
            scoreDiv.textContent = `Confidence: ${confidence}%`;

            // Change background color
            if(label === "neutral") {
                document.getElementById("container").style.backgroundColor = "#fdd835"; // yellow
            } else if(label === "toxic" || label === "offensive") {
                document.getElementById("container").style.backgroundColor = "#e53935"; // red
            } else {
                document.getElementById("container").style.backgroundColor = "#43a047"; // green
            }
        })
        .catch(err => {
            statusDiv.textContent = "Error connecting to API";
            console.error(err);
        });
}

// Request text from content script
chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
    }, () => {
        chrome.tabs.sendMessage(tabs[0].id, {action: "getPageText"}, (response) => {
            if(response && response.text) {
                analyzeText(response.text);
            } else {
                statusDiv.textContent = "No text found on page.";
            }
        });
    });
});
