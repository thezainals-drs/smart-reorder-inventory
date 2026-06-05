import { useState, useMemo, useEffect } from "react";

const TODAY = new Date();
TODAY.setHours(0,0,0,0);

function parseExpiry(str) {
  if (!str) return null;
  
  // Clean up the text coming from Google Sheets
  const s = String(str).trim().toLowerCase();
  
  // Rule A: If it is already a direct ISO date string from an API (like 2026-06-05T00:00:00.000Z)
  if (s.includes('t') && !isNaN(Date.parse(s))) {
    return new Date(s);
  }

  // Rule B: Standard Google Sheet date format (YYYY-MM-DD)
  const mISO = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (mISO) {
    return new Date(parseInt(mISO[1], 10), parseInt(mISO[2], 10) - 1, parseInt(mISO[3], 10));
  }

  // Rule C: Raw spreadsheet number format (like 46178)
  if (/^\d{5}$/.test(s)) {
    const sheetEpoch = new Date(1899, 11, 30);
    sheetEpoch.setDate(sheetEpoch.getDate() + parseInt(s, 10));
    return sheetEpoch;
  }

  // Rule D: Word-based dates (like "05 June 2026")
  const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,july:6,jul:6,aug:7,sept:8,sep:8,oct:9,nov:10,dec:11};
  const m1 = s.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (m1) return new Date(+m1[3], months[m1[2]], +m1[1]);
  
  const m2 = s.match(/([a-z]+)\s+(\d{4})/);
  if (m2) return new Date(+m2[2], months[m2[1]], 1);
  
  // Rule E: Slash format (like 05/06/2026)
  const m3 = s.match(/(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})/);
  if (m3) { 
    const y = m3[3].length === 2 ? 2000 + parseInt(m3[3], 10) : +m3[3]; 
    return new Date(y, +m3[2] - 1, +m3[1]); 
  }
  
  // SAFETY NET: If everything else fails, return the raw text as a fake Date object 
  // so your table displays the broken text structure instead of a blank space.
  return { isBroken: true, rawText: str };
}

function daysUntilExpiry(dateStr) {
  const d = parseExpiry(dateStr);
  if (!d) return null;
  if (d.isBroken) return d; // If it's a broken format, pass it straight to the badge
  return Math.ceil((d - TODAY) / 86400000);
}

function expiryBadge(days) {
  // If the safety net caught a broken data format, show the raw text on screen
  if (days && days.isBroken) {
    return { label: "Format: " + days.rawText, color: "#fff", bg: "#7b1fa2" };
  }
  if (days === null) return { label:"No date", color:"#555", bg:"#1a1a1a" };
  if (days < 0) return { label:"EXPIRED", color:"#ff4444", bg:"#2a0a0a" };
  if (days <= 30) return { label:`${days}d left`, color:"#ff6b35", bg:"#2a1200" };
  if (days <= 90) return { label:`${days}d left`, color:"#f0b429", bg:"#2a1f00" };
  return { label:`${days}d left`, color:"#4caf7d", bg:"#0a1f10" };
}

const PRICING_OPTIONS = ["Full Price","PWP","FOC"];
const STATUS_OPTIONS = ["available","sold","reserved","low"];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortBy, setSortBy] = useState("expiry");
  const [newProduct, setNewProduct] = useState({name:"",expiry:"",qty:1,label:"",pricing:"Full Price",price:"",soldTo:"",notes:"",status:"available"});

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    try {
      setLoading(true);
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
      else setError('Could not load inventory.');
    } catch(e) {
      setError('Could not connect to database.');
    } finally {
      setLoading(false);
    }
  }

  async function addProduct() {
    setSaving(true);
    try {
      await fetch('/api/inventory', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(newProduct)
      });
      setNewProduct({name:"",expiry:"",qty:1,label:"",pricing:"Full Price",price:"",soldTo:"",notes:"",status:"available"});
      setShowAddForm(false);
      await fetchProducts();
    } catch(e) { setError('Could not save.'); }
    finally { setSaving(false); }
  }

  async function saveEdit(p) {
    setSaving(true);
    try {
      await fetch('/api/inventory', {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(p)
      });
      setEditingId(null);
      await fetchProducts();
    } catch(e) { setError('Could not save.'); }
    finally { setSaving(false); }
  }

  async function markSold(p) {
    setSaving(true);
    try {
      await fetch('/api/inventory', {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({...p, status:'sold', qty: Math.max(0, p.qty-1)})
      });
      await fetchProducts();
    } catch(e) { setError('Could not save.'); }
    finally { setSaving(false); }
  }

  async function deleteProduct(p) {
    if (!confirm('Delete this product?')) return;
    setSaving(true);
    try {
      await fetch('/api/inventory', {
        method: 'DELETE',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({_rowIndex: p._rowIndex})
      });
      await fetchProducts();
    } catch(e) { setError('Could not delete.'); }
    finally { setSaving(false); }
  }

  function updateLocal(id, field, value) {
    setProducts(prev => prev.map(p => p.id===id ? {...p,[field]:value} : p));
  }

  const filtered = useMemo(() => {
    let list = [...products];
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    if (filter==='urgent') list = list.filter(p => { const d=daysUntilExpiry(p.expiry); return d!==null&&d<=90&&p.status!=='sold'; });
    if (filter==='available') list = list.filter(p => p.status==='available');
    if (filter==='sold') list = list.filter(p => p.status==='sold');
    if (sortBy==='expiry') list.sort((a,b) => (daysUntilExpiry(a.expiry)??9999)-(daysUntilExpiry(b.expiry)??9999));
    if (sortBy==='name') list.sort((a,b) => a.name.localeCompare(b.name));
    if (sortBy==='qty') list.sort((a,b) => b.qty-a.qty);
    return list;
  }, [products, filter, search, sortBy]);

  const urgentCount = products.filter(p => { const d=daysUntilExpiry(p.expiry); return d!==null&&d<=90&&p.status!=='sold'; }).length;

  const s = {
    app:{minHeight:"100vh",background:"#f7f4ef",fontFamily:"Georgia,serif",color:"#1a1a1a",margin:0},
    header:{background:"#1a1a2e",color:"#f7f4ef",padding:"20px 24px",borderBottom:"4px solid #c8963e"},
    headerTitle:{fontSize:"20px",fontWeight:"700",color:"#f7f4ef",margin:"0 0 4px 0"},
    headerSub:{fontSize:"11px",color:"#8a8aaa",letterSpacing:"3px",textTransform:"uppercase"},
    stats:{display:"flex",gap:"16px",marginTop:"16px",flexWrap:"wrap"},
    stat:{background:"rgba(255,255,255,0.07)",borderRadius:"6px",padding:"10px 16px"},
    statNum:{fontSize:"24px",fontWeight:"700",color:"#c8963e"},
    statLabel:{fontSize:"10px",color:"#8a8aaa",letterSpacing:"2px",textTransform:"uppercase"},
    controls:{padding:"14px 24px",background:"#fff",borderBottom:"1px solid #e8e0d0",display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center"},
    searchInput:{border:"1px solid #d0c8b8",borderRadius:"4px",padding:"7px 12px",fontSize:"14px",fontFamily:"Georgia,serif",background:"#faf8f4",flex:"1",minWidth:"140px"},
    filterBtn:(active)=>({background:active?"#1a1a2e":"transparent",color:active?"#f7f4ef":"#555",border:"1px solid",borderColor:active?"#1a1a2e":"#d0c8b8",borderRadius:"4px",padding:"6px 12px",fontSize:"11px",letterSpacing:"1px",textTransform:"uppercase",cursor:"pointer",fontFamily:"Georgia,serif"}),
    addBtn:{background:"#c8963e",color:"#fff",border:"none",borderRadius:"4px",padding:"7px 16px",fontSize:"12px",fontWeight:"700",cursor:"pointer",fontFamily:"Georgia,serif",marginLeft:"auto"},
    select:{border:"1px solid #d0c8b8",borderRadius:"3px",padding:"6px 8px",fontSize:"12px",fontFamily:"Georgia,serif",background:"#faf8f4"},
    addForm:{background:"#1a1a2e",padding:"20px 24px",borderBottom:"2px solid #c8963e"},
    addGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))",gap:"10px"},
    addLabel:{fontSize:"10px",letterSpacing:"2px",color:"#8a8aaa",textTransform:"uppercase",display:"block",marginBottom:"3px"},
    addInput:{border:"1px solid #3a3a5e",borderRadius:"3px",padding:"7px 9px",fontSize:"13px",fontFamily:"Georgia,serif",background:"#0d0d22",color:"#f7f4ef",width:"100%",boxSizing:"border-box"},
    saveBtn:{background:"#c8963e",color:"#fff",border:"none",padding:"9px 20px",fontSize:"12px",fontWeight:"700",cursor:"pointer",borderRadius:"3px",fontFamily:"Georgia,serif",marginTop:"14px",marginRight:"10px"},
    cancelBtn:{background:"transparent",color:"#8a8aaa",border:"1px solid #3a3a5e",padding:"9px 16px",fontSize:"12px",cursor:"pointer",borderRadius:"3px",fontFamily:"Georgia,serif",marginTop:"14px"},
    table:{width:"100%",borderCollapse:"collapse",fontSize:"13px"},
    th:{background:"#f0ebe0",padding:"9px 12px",fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:"#888",textAlign:"left",borderBottom:"2px solid #e0d8c8"},
    td:{padding:"10px 12px",borderBottom:"1px solid #f0ebe0",verticalAlign:"middle"},
    badge:(days)=>{ const b=expiryBadge(days); return {background:b.bg,color:b.color,padding:"2px 7px",borderRadius:"3px",fontSize:"10px",fontWeight:"700",letterSpacing:"1px",display:"inline-block"}; },
    statusBadge:(st)=>({background:st==="sold"?"#0a2a0a":st==="reserved"?"#1a1a2e":st==="low"?"#2a1200":"#f0ebe0",color:st==="sold"?"#5a9a5a":st==="reserved"?"#8a8aef":st==="low"?"#ff6b35":"#888",padding:"2px 7px",borderRadius:"3px",fontSize:"10px",fontWeight:"600",letterSpacing:"1px"}),
    input:{border:"1px solid #d0c8b8",borderRadius:"3px",padding:"4px 7px",fontSize:"12px",fontFamily:"Georgia,serif",background:"#faf8f4",width:"100%",boxSizing:"border-box"},
    editSelect:{border:"1px solid #d0c8b8",borderRadius:"3px",padding:"4px 5px",fontSize:"11px",fontFamily:"Georgia,serif",background:"#faf8f4"},
    actionBtn:(color)=>({background:"transparent",border:`1px solid ${color}`,color:color,borderRadius:"3px",padding:"3px 8px",fontSize:"10px",cursor:"pointer",fontFamily:"Georgia,serif",marginRight:"4px"}),
    rowBg:(days,status)=>{ if(status==="sold") return {background:"#f9f9f7",opacity:0.6}; if(days!==null&&days<0) return {background:"#fff5f5"}; if(days!==null&&days<=30) return {background:"#fff9f0"}; if(days!==null&&days<=90) return {background:"#fffdf5"}; return {}; },
  };

  return (
    <div style={s.app}>
      <div style={s.header}>
        <div style={s.headerTitle}>⚖️ Supplements Inventory</div>
        <div style={s.headerSub}>DR's Secret · Avance · Optrimax {saving && "· Saving..."}</div>
        <div style={s.stats}>
          <div style={s.stat}><div style={s.statNum}>{products.filter(p=>p.status!=='sold').reduce((a,p)=>a+p.qty,0)}</div><div style={s.statLabel}>Total Units</div></div>
          <div style={{...s.stat,borderLeft:"2px solid #ff4444"}}><div style={{...s.statNum,color:"#ff6b6b"}}>{products.filter(p=>{const d=daysUntilExpiry(p.expiry);return d!==null&&d<0&&p.status!=='sold';}).length}</div><div style={s.statLabel}>Expired</div></div>
          <div style={{...s.stat,borderLeft:"2px solid #f0b429"}}><div style={{...s.statNum,color:"#f0b429"}}>{urgentCount}</div><div style={s.statLabel}>Urgent &lt;90d</div></div>
          <div style={{...s.stat,borderLeft:"2px solid #4caf7d"}}><div style={{...s.statNum,color:"#4caf7d"}}>{products.filter(p=>p.status==='sold').length}</div><div style={s.statLabel}>Sold</div></div>
        </div>
      </div>

      <div style={s.controls}>
        <input style={s.searchInput} placeholder="Search product..." value={search} onChange={e=>setSearch(e.target.value)} />
        {["all","urgent","available","sold"].map(f=>(
          <button key={f} style={s.filterBtn(filter===f)} onClick={()=>setFilter(f)}>
            {f==="urgent"?`Urgent (${urgentCount})`:f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
        <select style={s.select} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
          <option value="expiry">Sort: Expiry</option>
          <option value="name">Sort: Name</option>
          <option value="qty">Sort: Qty</option>
        </select>
        <button style={s.addBtn} onClick={()=>setShowAddForm(!showAddForm)}>+ Add</button>
      </div>

      {showAddForm && (
        <div style={s.addForm}>
          <div style={{color:"#c8963e",fontSize:"12px",letterSpacing:"3px",textTransform:"uppercase",marginBottom:"14px"}}>Add New Product</div>
          <div style={s.addGrid}>
            {[["name","Product Name"],["expiry","Expiry (DD Mon YYYY)"],["qty","Qty"],["label","Batch Label"],["price","Price (RM)"],["soldTo","Sold To"],["notes","Notes"]].map(([field,label])=>(
              <div key={field}>
                <label style={s.addLabel}>{label}</label>
                <input style={s.addInput} value={newProduct[field]} onChange={e=>setNewProduct(p=>({...p,[field]:e.target.value}))} type={field==="qty"?"number":"text"} />
              </div>
            ))}
            <div><label style={s.addLabel}>Pricing</label><select style={s.addInput} value={newProduct.pricing} onChange={e=>setNewProduct(p=>({...p,pricing:e.target.value}))}>{PRICING_OPTIONS.map(o=><option key={o}>{o}</option>)}</select></div>
            <div><label style={s.addLabel}>Status</label><select style={s.addInput} value={newProduct.status} onChange={e=>setNewProduct(p=>({...p,status:e.target.value}))}>{STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}</select></div>
          </div>
          <button style={s.saveBtn} onClick={addProduct}>Save to Google Sheets</button>
          <button style={s.cancelBtn} onClick={()=>setShowAddForm(false)}>Cancel</button>
        </div>
      )}

      {loading ? (
        <div style={{textAlign:"center",padding:"60px",color:"#888",fontSize:"14px"}}>Loading inventory from Google Sheets...</div>
      ) : error ? (
        <div style={{textAlign:"center",padding:"40px",color:"#cc4444",fontSize:"14px"}}>{error} <button onClick={fetchProducts} style={{marginLeft:"12px",cursor:"pointer"}}>Retry</button></div>
      ) : (
        <div style={{overflowX:"auto"}}>
          <table style={s.table}>
            <thead>
              <tr>{["Product","Expiry","Qty","Pricing","Price (RM)","Sold To","Notes","Status","Actions"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const days = daysUntilExpiry(p.expiry);
                const badge = expiryBadge(days);
                const isEditing = editingId===p.id;
                return (
                  <tr key={p.id} style={s.rowBg(days,p.status)}>
                    <td style={s.td}><div style={{fontWeight:"600",color:"#1a1a2e"}}>{p.name}</div>{p.label&&<div style={{fontSize:"11px",color:"#aaa",marginTop:"2px"}}>{p.label}</div>}</td>
                    <td style={s.td}>
                      {isEditing?<input style={{...s.input,width:"120px"}} value={p.expiry} onChange={e=>updateLocal(p.id,"expiry",e.target.value)} />:(
                        <div><div style={{fontSize:"12px",color:"#555",marginBottom:"3px"}}>{p.expiry||"—"}</div><span style={s.badge(days)}>{badge.label}</span></div>
                      )}
                    </td>
                    <td style={s.td}>
                      {isEditing?<input style={{...s.input,width:"55px"}} type="number" value={p.qty} onChange={e=>updateLocal(p.id,"qty",+e.target.value)} />:
                        <span style={{fontSize:"17px",fontWeight:"700",color:p.qty===0?"#cc4444":p.qty<=2?"#f0b429":"#1a1a2e"}}>{p.qty}</span>}
                    </td>
                    <td style={s.td}>
                      {isEditing?<select style={s.editSelect} value={p.pricing} onChange={e=>updateLocal(p.id,"pricing",e.target.value)}>{PRICING_OPTIONS.map(o=><option key={o}>{o}</option>)}</select>:
                        <span style={{fontSize:"11px",color:p.pricing==="FOC"?"#5a9a5a":p.pricing==="PWP"?"#c8963e":"#555",fontWeight:"600"}}>{p.pricing}</span>}
                    </td>
                    <td style={s.td}>
                      {isEditing?<input style={{...s.input,width:"75px"}} value={p.price} onChange={e=>updateLocal(p.id,"price",e.target.value)} />:
                        <span>{p.price?`RM ${p.price}`:"—"}</span>}
                    </td>
                    <td style={s.td}>
                      {isEditing?<input style={{...s.input,width:"110px"}} value={p.soldTo} onChange={e=>updateLocal(p.id,"soldTo",e.target.value)} />:
                        <span style={{color:"#555",fontSize:"12px"}}>{p.soldTo||"—"}</span>}
                    </td>
                    <td style={s.td}>
                      {isEditing?<input style={{...s.input,width:"140px"}} value={p.notes} onChange={e=>updateLocal(p.id,"notes",e.target.value)} />:
                        <span style={{color:"#888",fontSize:"11px"}}>{p.notes||"—"}</span>}
                    </td>
                    <td style={s.td}>
                      {isEditing?<select style={s.editSelect} value={p.status} onChange={e=>updateLocal(p.id,"status",e.target.value)}>{STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}</select>:
                        <span style={s.statusBadge(p.status)}>{p.status}</span>}
                    </td>
                    <td style={s.td}>
                      {isEditing?(
                        <>
                          <button style={s.actionBtn("#4caf7d")} onClick={()=>saveEdit(p)}>✓ Save</button>
                          <button style={s.actionBtn("#888")} onClick={()=>setEditingId(null)}>Cancel</button>
                        </>
                      ):(
                        <>
                          <button style={s.actionBtn("#c8963e")} onClick={()=>setEditingId(p.id)}>Edit</button>
                          <button style={s.actionBtn("#5a9a5a")} onClick={()=>markSold(p)}>Sold</button>
                          <button style={s.actionBtn("#cc4444")} onClick={()=>deleteProduct(p)}>✕</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length===0&&<div style={{textAlign:"center",padding:"40px",color:"#aaa"}}>No products found.</div>}
        </div>
      )}
      <div style={{padding:"12px 24px",background:"#f0ebe0",borderTop:"1px solid #e0d8c8",fontSize:"11px",color:"#aaa"}}>
        🔴 Expired · 🟠 &lt;30d · 🟡 &lt;90d · 🟢 Safe · All changes saved to Google Sheets
      </div>
    </div>
  );
}
