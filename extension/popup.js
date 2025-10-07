document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const text = document.getElementById("inputText").value;
  if (!text) {
    document.getElementById("result").innerText = "⚠️ Please enter text!";
    return;
  }

  document.getElementById("result").innerText = "⏳ Analyzing...";

  try {
    const response = await fetch("http://127.0.0.1:5000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    const data = await response.json();
    document.getElementById("result").innerText = `${data.status}\nConfidence: ${data.confidence}%`;
  } catch (error) {
    document.getElementById("result").innerText = "❌ Error connecting to backend!";
  }
});
