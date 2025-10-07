// Automatically check text on any webpage (optional feature)
const pageText = document.body.innerText.slice(0, 2000); // analyze first 2000 chars

fetch("http://127.0.0.1:5000/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: pageText })
})
  .then(res => res.json())
  .then(data => {
    if (data.status.includes("Toxic")) {
      alert(`⚠️ Warning: This page contains toxic content!\n(${data.label})`);
    }
  })
  .catch(err => console.error("Error analyzing page:", err));
