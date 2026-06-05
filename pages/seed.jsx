import { useState } from "react";

export default function Seed() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function populate() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ ok: true, msg: `✅ Done! ${data.count} products added to Google Sheets.` });
      } else {
        setStatus({ ok: false, msg: '❌ Error: ' + (data.error || 'Unknown error') });
      }
    } catch(e) {
      setStatus({ ok: false, msg: '❌ Failed: ' + e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily:"Georgia,serif", background:"#1a1a2e", minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#f7f4ef" }}>
      <h2 style={{ color:"#c8963e", marginBottom:"8px" }}>⚖️ Populate Inventory</h2>
      <p style={{ color:"#8a8aaa", fontSize:"14px", marginBottom:"32px", textAlign:"center" }}>
        Tap the button to load all 33 products<br/>into your Google Sheet.
      </p>
      <button
        onClick={populate}
        disabled={loading}
        style={{ background:"#c8963e", color:"#fff", border:"none", padding:"18px 40px", fontSize:"18px", fontFamily:"Georgia,serif", fontWeight:"700", borderRadius:"6px", cursor: loading?"not-allowed":"pointer", opacity: loading?0.5:1 }}
      >
        {loading ? "Populating..." : "Populate Google Sheets Now"}
      </button>
      {status && (
        <div style={{ marginTop:"24px", fontSize:"15px", color: status.ok?"#4caf7d":"#ff6b6b" }}>
          {status.msg}
        </div>
      )}
      {status?.ok && (
        <a href="/" style={{ marginTop:"20px", color:"#c8963e", fontSize:"14px" }}>
          → Go to Inventory
        </a>
      )}
    </div>
  );
}
