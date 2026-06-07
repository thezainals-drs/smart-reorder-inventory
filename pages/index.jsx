import { useState, useMemo, useEffect } from "react";

const TODAY = new Date();
TODAY.setHours(0,0,0,0);

function parseExpiry(str) {
  if (!str) return null;
  const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,july:6,jul:6,aug:7,sept:8,sep:8,oct:9,nov:10,dec:11};
  const s = str.trim().toLowerCase();
  const m1 = s.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (m1) return new Date(+m1[3], months[m1[2]], +m1[1]);
  const m2 = s.match(/([a-z]+)\s+(\d{4})/);
  if (m2) return new Date(+m2[2], months[m2[1]], 1);
  const m3 = s.match(/(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})/);
  if (m3) { const y = m3[3].length===2?2000+parseInt(m3[3]):+m3[3]; return new Date(y,+m3[2]-1,+m3[1]); }
  return null;
}

function daysUntilExpiry(dateStr) {
  const d = parseExpiry(dateStr);
  if (!d) return null;
  return Math.ceil((d - TODAY) / 86400000);
}

function expiryBadge(days) {
  if (days === null) return { label:"—", color:"#555", bg:"transparent" };
  if (days < 0) return { label:"EXPIRED", color:"#ff4444", bg:"#2a0a0a" };
  if (days <= 30) return { label:`${days}d left`, color:"#ff6b35", bg:"#2a1200" };
  if (days <= 90) return { label:`${days}d left`, color:"#f0b429", bg:"#2a1f00" };
  return { label:`${days}d left`, color:"#4caf7d", bg:"#0a1f10" };
}

const PRICING_OPTIONS = ["Full Price","PWP","FOC"];
const STATUS_OPTIONS = ["available","sold","reserved","low"];
const CATEGORY_OPTIONS = ["Supplement","Skincare"];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortBy, setSortBy] = useState("expiry");
  const [newProduct, setNewProduct] = useState({category:"Supplement",name:"",code:"",expiry:"",qty:1,label:"",pricing:"Full Price",price:"",soldTo:"",notes:"",status:"available"});
  
  // Track mobile layout dynamically
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // 1. Force the mobile viewport meta rule injection
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.getElementsByTagName('head')[0].appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    
    // 2. Add responsive layout listener
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    handleResize(); // run immediately on mount
    window.addEventListener('resize', handleResize);
    fetchProducts();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  async function fetchProducts() {
    try {
      setLoading(true);
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
      else setError('Could not load inventory.');
    } catch(e) { setError('Could not connect to database.'); }
    finally { setLoading(false); }
  }

  async function addProduct() {
    setSaving(true);
    try {
      await fetch('/api/inventory', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(newProduct) });
      setNewProduct({category:"Supplement",name:"",code:"",expiry:"",qty:1,label:"",pricing:"Full Price",price:"",soldTo:"",notes:"",status:"available"});
      setShowAddForm(false);
      await fetchProducts();
    } catch(e) { setError('Could not save.'); }
    finally { setSaving(false); }
  }

  async function saveEdit(p) {
    setSaving(true);
    try {
      await fetch('/api/inventory', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(p) });
      setEditingId(null);
      await fetchProducts();
    } catch(e) { setError('Could not save.'); }
    finally { setSaving(false); }
  }

  async function markSold(p) {
    setSaving(true);
    try {
      await fetch('/api/inventory', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...p, status:'sold', qty:Math.max(0,p.qty-1)}) });
      await fetchProducts();
    } catch(e) { setError('Could not save.'); }
    finally { setSaving(false); }
  }

  async function deleteProduct(p) {
    if (!confirm('Delete this product?')) return;
    setSaving(true);
    try {
      await fetch('/api/inventory', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({_rowIndex:p._rowIndex}) });
      await fetchProducts();
    } catch(e) { setError('Could not delete.'); }
    finally { setSaving(false); }
  }

  function updateLocal(id, field, value) {
    setProducts(prev => prev.map(p => p.id===id ? {...p,[field]:value} : p));
  }

  const filtered = useMemo(() => {
    let list = [...products];
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.code||'').toLowerCase().includes(search.toLowerCase()));
    if (categoryFilter !== 'all') list = list.filter(p => p.category === categoryFilter);
    if (filter === 'urgent') list = list.filter(p => { const d=daysUntilExpiry(p.expiry); return d!==null&&d<=90&&p.status!=='sold'; });
    if (filter === 'available') list = list.filter(p => p.status==='available');
    if (filter === 'sold') list = list.filter(p => p.status==='sold');
    if (filter === 'low') list = list.filter(p => p.qty<=2&&p.status!=='sold');
    if (sortBy==='expiry') list.sort((a,b) => (daysUntilExpiry(a.expiry)??9999)-(daysUntilExpiry(b.expiry)??9999));
    if (sortBy==='name') list.sort((a,b) => a.name.localeCompare(b.name));
    if (sortBy==='qty') list.sort((a,b) => b.qty-a.qty);
    if (sortBy==='category') list.sort((a,b) => a.category.localeCompare(b.category));
    return list;
  }, [products, filter, categoryFilter, search, sortBy]);

  const urgentCount = products.filter(p => { const d=daysUntilExpiry(p.expiry); return d!==null&&d<=90&&p.status!=='sold'; }).length;
  const catBadge = (cat) => ({background:cat==='Skincare'?"#2a0a1e":"#0a1020",color:cat==='Skincare'?"#e879b8":"#7a9aef",padding:"2px 7px",borderRadius:"3px",fontSize:"9px",fontWeight:"700",letterSpacing:"1px"});
  const statusBadge = (st) => ({background:st==="sold"?"#0a2a0a":st==="reserved"?"#1a1a2e":st==="low"?"#2a1200":"#f0ebe0",color:st==="sold"?"#5a9a5a":st==="reserved"?"#8a8aef":st==="low"?"#ff6b35":"#888",padding:"2px 7px",borderRadius:"3px",fontSize:"10px",fontWeight:"600",letterSpacing:"1px"});
  const ab = (color) => ({background:"transparent",border:`1px solid ${color}`,color,borderRadius:"3px",padding:"3px 8px",fontSize:"10px",cursor:"pointer",fontFamily:"Georgia,serif",marginRight:"4px"});
  const inp = {border:"1px solid #d0c8b8",borderRadius:"3px",padding:"4px 7px",fontSize:"12px",fontFamily:"Georgia,serif",background:"#faf8f4",boxSizing:"border-box"};
  const sel = {border:"1px solid #d0c8b8",borderRadius:"3px",padding:"4px 5px",fontSize:"11px",fontFamily:"Georgia,serif",background:"#faf8f4"};
  const td = {padding:"10px 12px",borderBottom:"1px solid #f0ebe0",verticalAlign:"middle"};

  return (
    <div style={{minHeight:"100vh",background:"#f7f4ef",fontFamily:"Georgia,serif",color:"#1a1a1a",margin:0,width:"100%"}}>
      <style>{`
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: 100%; overflow-x: hidden; -webkit-text-size-adjust: 100%; }
        
        /* Forces external NextJS framework wrappers to collapse nicely on phones */
        #__next, main, header, wrapper { min-width: 100% !important; max-width: 100% !important; overflow-x: hidden !important; }
        
        .fscroll { display:flex; gap:6px; flex-wrap:nowrap; overflow-x:auto; padding-bottom:4px; width: 100%; }
        .fscroll::-webkit-scrollbar { display:none; }
        button:active { opacity:0.7; }
      `}</style>

      {/* Main Top Header Section */}
      <div style={{background:"#1a1a2e",color:"#f7f4ef",padding:"16px 20px",borderBottom:"4px solid #c8963e"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:"18px",fontWeight:"700",color:"#f7f7f7"}}>⚖️ Smart Reorder</div>
            <div style={{fontSize:"10px",color:"#8a8aaa",letterSpacing:"2px",textTransform:"uppercase",marginTop:"2px"}}>DR's Secret · Avance {saving&&"· Saving..."}</div>
          </div>
          <button onClick={()=>setShowAddForm(!showAddForm)} style={{background:"#c8963e",color:"#fff",border:"none",borderRadius:"8px",padding:"10px 16px",fontSize:"13px",fontWeight:"700",cursor:"pointer",fontFamily:"Georgia,serif"}}>+ Add</button>
        </div>
        <div style={{display:"flex",gap:"8px",marginTop:"14px",overflowX:"auto",paddingBottom:"4px"}} className="fscroll">
          {[[products.filter(p=>p.status!=='sold').reduce((a,p)=>a+p.qty,0),"Units","#c8963e",""],[products.filter(p=>p.category==='Skincare').length,"Skincare","#e879b8","#e879b8"],[products.filter(p=>p.category==='Supplement').length,"Supps","#7a9aef","#7a9aef"],[urgentCount,"Urgent","#ff6b6b","#ff4444"]].map(([n,l,color,border])=>(
            <div key={l} style={{background:"rgba(255,255,255,0.07)",borderRadius:"8px",padding:"10px 14px",borderLeft:border?`3px solid ${border}`:"none",minWidth:"85px",flex:"1"}}>
              <div style={{fontSize:"18px",fontWeight:"700",color}}>{n}</div>
              <div style={{fontSize:"9px",color:"#8a8aaa",letterSpacing:"1px",textTransform:"uppercase"}}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Selection Tabs */}
      <div style={{display:"flex",background:"#f0ebe0",borderBottom:"1px solid #e0d8c8",overflowX:"auto"}}>
        {[["all","All"],["Supplement","Supplements"],["Skincare","DR's Secret"]].map(([val,label])=>(
          <button key={val} onClick={()=>setCategoryFilter(val)} style={{flex:1,padding:"12px 8px",textAlign:"center",fontSize:"11px",fontWeight:"700",letterSpacing:"1px",textTransform:"uppercase",color:categoryFilter===val?"#1a1a2e":"#aaa",background:"transparent",border:"none",borderBottom:categoryFilter===val?"3px solid #c8963e":"3px solid transparent",cursor:"pointer",fontFamily:"Georgia,serif",whiteSpace:"nowrap"}}>{label}</button>
        ))}
      </div>

      {/* Control Filter Bar */}
      <div style={{padding:"12px 16px",background:"#fff",borderBottom:"1px solid #e8e0d0"}}>
        <input style={{width:"100%",border:"1px solid #d0c8b8",borderRadius:"20px",padding:"10px 16px",fontSize:"13px",fontFamily:"Georgia,serif",background:"#faf8f4",marginBottom:"10px"}} placeholder="Search by name or code..." value={search} onChange={e=>setSearch(e.target.value)} />
        <div className="fscroll">
          {[["all","All"],["urgent",`Urgent (${urgentCount})`],["available","Available"],["low","Low Stock"],["sold","Sold"]].map(([f,label])=>(
            <button key={f} onClick={()=>setFilter(f)} style={{background:filter===f?"#1a1a2e":"#f0ebe0",color:filter===f?"#fff":"#888",border:"none",borderRadius:"20px",padding:"6px 14px",fontSize:"11px",fontWeight:"600",cursor:"pointer",fontFamily:"Georgia,serif",whiteSpace:"nowrap"}}>{label}</button>
          ))}
          {!isMobile && (
            <select style={{border:"1px solid #d0c8b8",borderRadius:"20px",padding:"6px 12px",fontSize:"11px",fontFamily:"Georgia,serif",background:"#f0ebe0",marginLeft:"auto"}} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
              <option value="expiry">Sort: Expiry</option>
              <option value="name">Sort: Name</option>
              <option value="qty">Sort: Qty</option>
              <option value="category">Sort: Category</option>
            </select>
          )}
        </div>
      </div>

      {/* Product Submission Input Form */}
      {showAddForm && (
        <div style={{background:"#1a1a2e",padding:"16px 20px",borderBottom:"2px solid #c8963e"}}>
          <div style={{color:"#c8963e",fontSize:"11px",letterSpacing:"3px",textTransform:"uppercase",marginBottom:"12px"}}>Add New Product</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))",gap:"10px"}}>
            <div><label style={{fontSize:"10px",letterSpacing:"2px",color:"#8a8aaa",textTransform:"uppercase",display:"block",marginBottom:"3px"}}>Category</label><select style={{border:"1px solid #3a3a5e",borderRadius:"6px",padding:"8px",fontSize:"13px",fontFamily:"Georgia,serif",background:"#0d0d22",color:"#f7f4ef",width:"100%"}} value={newProduct.category} onChange={e=>setNewProduct(p=>({...p,category:e.target.value}))}>{CATEGORY_OPTIONS.map(o=><option key={o}>{o}</option>)}</select></div>
            {[["name","Product Name"],["code","Product Code"],["expiry","Expiry (DD Mon YYYY)"],["qty","Qty"],["label","Batch Label"],["price","Price (RM)"],["soldTo","Sold To"],["notes","Notes"]].map(([field,label])=>(
              <div key={field}><label style={{fontSize:"10px",letterSpacing:"2px",color:"#8a8aaa",textTransform:"uppercase",display:"block",marginBottom:"3px"}}>{label}</label><input style={{border:"1px solid #3a3a5e",borderRadius:"6px",padding:"8px",fontSize:"13px",fontFamily:"Georgia,serif",background:"#0d0d22",color:"#f7f4ef",width:"100%"}} value={newProduct[field]} onChange={e=>setNewProduct(p=>({...p,[field]:e.target.value}))} type={field==="qty"?"number":"text"} /></div>
            ))}
            <div><label style={{fontSize:"10px",letterSpacing:"2px",color:"#8a8aaa",textTransform:"uppercase",display:"block",marginBottom:"3px"}}>Pricing</label><select style={{border:"1px solid #3a3a5e",borderRadius:"6px",padding:"8px",fontSize:"13px",fontFamily:"Georgia,serif",background:"#0d0d22",color:"#f7f4ef",width:"100%"}} value={newProduct.pricing} onChange={e=>setNewProduct(p=>({...p,pricing:e.target.value}))}>{PRICING_OPTIONS.map(o=><option key={o}>{o}</option>)}</select></div>
            <div><label style={{fontSize:"10px",letterSpacing:"2px",color:"#8a8aaa",textTransform:"uppercase",display:"block",marginBottom:"3px"}}>Status</label><select style={{border:"1px solid #3a3a5e",borderRadius:"6px",padding:"8px",fontSize:"13px",fontFamily:"Georgia,serif",background:"#0d0d22",color:"#f7f4ef",width:"100%"}} value={newProduct.status} onChange={e=>setNewProduct(p=>({...p,status:e.target.value}))}>{STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}</select></div>
          </div>
          <div style={{display:"flex",gap:"10px",marginTop:"14px"}}>
            <button onClick={addProduct} style={{background:"#c8963e",color:"#fff",border:"none",padding:"10px 24px",fontSize:"13px",fontWeight:"700",cursor:"pointer",borderRadius:"8px",fontFamily:"Georgia,serif"}}>Save to Google Sheets</button>
            <button onClick={()=>setShowAddForm(false)} style={{background:"transparent",color:"#8a8aaa",border:"1px solid #3a3a5e",padding:"10px 16px",fontSize:"13px",cursor:"pointer",borderRadius:"8px",fontFamily:"Georgia,serif"}}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{textAlign:"center",padding:"60px",color:"#888",fontSize:"14px"}}>Loading from Google Sheets...</div>
      ) : error ? (
        <div style={{textAlign:"center",padding:"40px",color:"#cc4444",fontSize:"14px"}}>{error} <button onClick={fetchProducts} style={{marginLeft:"12px",cursor:"pointer",padding:"6px 12px",borderRadius:"6px",border:"1px solid #cc4444",background:"transparent",color:"#cc4444",fontFamily:"Georgia,serif"}}>Retry</button></div>
      ) : (
        <>
          {isMobile ? (
            /* ========================================================
               MOBILE CARD VIEW (Triggered strictly by JS viewport dimensions)
               ======================================================== */
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px", width: "100%" }}>
              {filtered.length===0 && <div style={{textAlign:"center",padding:"40px",color:"#aaa"}}>No products found.</div>}
              {filtered.map(p => {
                const days = daysUntilExpiry(p.expiry);
                const badge = expiryBadge(days);
                const borderColor = days!==null&&days<0?"#ff4444":days!==null&&days<=30?"#ff6b35":days!==null&&days<=90?"#f0b429":"#e0d8c8";
                const isEditing = editingId===p.id;
                return (
                  <div key={p.id} style={{background:"#fff",borderRadius:"12px",overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.08)",borderLeft:`4px solid ${borderColor}`,opacity:p.status==='sold'?0.6:1}}>
                    
                    {/* Card Content Top Layout */}
                    <div style={{padding:"12px 14px 8px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:"6px",alignItems:"center",marginBottom:"4px",flexWrap:"wrap"}}>
                          <span style={catBadge(p.category)}>{p.category==='Skincare'?'SKIN':'SUPP'}</span>
                          {p.expiry && <span style={{background:badge.bg,color:badge.color,padding:"2px 7px",borderRadius:"3px",fontSize:"9px",fontWeight:"700"}}>{badge.label}</span>}
                          <span style={{...statusBadge(p.status),fontSize:"9px"}}>{p.status}</span>
                        </div>
                        <div style={{fontSize:"15px",fontWeight:"700",color:"#1a1a2e"}}>{p.name}</div>
                        {p.label && <div style={{fontSize:"11px",color:"#aaa",marginTop:"2px"}}>{p.label}</div>}
                        {p.code && <div style={{fontSize:"10px",color:"#aaa",fontFamily:"monospace",marginTop:"2px"}}>{p.code}</div>}
                      </div>
                      <div style={{textAlign:"right",marginLeft:"12px"}}>
                        <div style={{fontSize:"28px",fontWeight:"700",color:p.qty===0?"#cc4444":p.qty<=2?"#f0b429":"#1a1a2e",lineHeight:1}}>{p.qty}</div>
                        <div style={{fontSize:"9px",color:"#aaa",textTransform:"uppercase",letterSpacing:"1px"}}>units</div>
                      </div>
                    </div>

                    {/* Modification Panel Details */}
                    {isEditing ? (
                      <div style={{padding:"10px 14px",background:"#faf8f4",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                        {[["expiry","Expiry"],["qty","Qty"],["price","Price (RM)"],["soldTo","Sold To"],["notes","Notes"]].map(([field,label])=>(
                          <div key={field}>
                            <div style={{fontSize:"9px",color:"#aaa",textTransform:"uppercase",letterSpacing:"1px",marginBottom:"2px"}}>{label}</div>
                            <input style={{border:"1px solid #d0c8b8",borderRadius:"6px",padding:"6px 8px",fontSize:"12px",fontFamily:"Georgia,serif",background:"#fff",width:"100%"}} value={p[field]||""} onChange={e=>updateLocal(p.id,field,field==="qty"?+e.target.value:e.target.value)} type={field==="qty"?"number":"text"} />
                          </div>
                        ))}
                        <div><div style={{fontSize:"9px",color:"#aaa",textTransform:"uppercase",letterSpacing:"1px",marginBottom:"2px"}}>Pricing</div><select style={{border:"1px solid #d0c8b8",borderRadius:"6px",padding:"6px",fontSize:"12px",fontFamily:"Georgia,serif",background:"#fff",width:"100%"}} value={p.pricing} onChange={e=>updateLocal(p.id,"pricing",e.target.value)}>{PRICING_OPTIONS.map(o=><option key={o}>{o}</option>)}</select></div>
                        <div><div style={{fontSize:"9px",color:"#aaa",textTransform:"uppercase",letterSpacing:"1px",marginBottom:"2px"}}>Status</div><select style={{border:"1px solid #d0c8b8",borderRadius:"6px",padding:"6px",fontSize:"12px",fontFamily:"Georgia,serif",background:"#fff",width:"100%"}} value={p.status} onChange={e=>updateLocal(p.id,"status",e.target.value)}>{STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}</select></div>
                      </div>
                    ) : (
                      <div style={{padding:"8px 14px",background:"#faf8f4",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                        <div><div style={{fontSize:"9px",color:"#aaa",textTransform:"uppercase",letterSpacing:"1px"}}>Expiry</div><div style={{fontSize:"12px",color:"#555"}}>{p.expiry||"—"}</div></div>
                        <div><div style={{fontSize:"9px",color:"#aaa",textTransform:"uppercase",letterSpacing:"1px"}}>Price</div><div style={{fontSize:"12px",color:"#1a1a2e",fontWeight:"600"}}>{p.price?`RM ${p.price}`:"—"}</div></div>
                        <div><div style={{fontSize:"9px",color:"#aaa",textTransform:"uppercase",letterSpacing:"1px"}}>Pricing</div><div style={{fontSize:"12px",color:p.pricing==="PWP"?"#c8963e":p.pricing==="FOC"?"#5a9a5a":"#555"}}>{p.pricing}</div></div>
                        {p.notes && <div><div style={{fontSize:"9px",color:"#aaa",textTransform:"uppercase",letterSpacing:"1px"}}>Notes</div><div style={{fontSize:"12px",color:"#888"}}>{p.notes}</div></div>}
                      </div>
                    )}

                    {/* Operational Action Footer */}
                    <div style={{padding:"8px 14px",display:"flex",gap:"8px",borderTop:"1px solid #f0ebe0"}}>
                      {isEditing ? (
                        <>
                          <button onClick={()=>saveEdit(p)} style={{flex:1,background:"#4caf7d",border:"none",color:"#fff",borderRadius:"8px",padding:"8px",fontSize:"12px",fontWeight:"600",cursor:"pointer",fontFamily:"Georgia,serif"}}>✓ Save</button>
                          <button onClick={()=>setEditingId(null)} style={{flex:1,background:"transparent",border:"1px solid #ddd",color:"#888",borderRadius:"8px",padding:"8px",fontSize:"12px",cursor:"pointer",fontFamily:"Georgia,serif"}}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={()=>setEditingId(p.id)} style={{flex:1,background:"transparent",border:"1px solid #c8963e",color:"#c8963e",borderRadius:"8px",padding:"8px",fontSize:"12px",fontWeight:"600",cursor:"pointer",fontFamily:"Georgia,serif"}}>Edit</button>
                          <button onClick={()=>markSold(p)} style={{flex:2,background:"#5a9a5a",border:"none",color:"#fff",borderRadius:"8px",padding:"8px",fontSize:"12px",fontWeight:"600",cursor:"pointer",fontFamily:"Georgia,serif"}}>Mark Sold</button>
                          <button onClick={()=>deleteProduct(p)} style={{background:"transparent",border:"1px solid #cc4444",color:"#cc4444",borderRadius:"8px",padding:"8px 10px",fontSize:"12px",cursor:"pointer",fontFamily:"Georgia,serif"}}>✕</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ========================================================
               DESKTOP TABLE VIEW (Rendered strictly on widescreen viewports)
               ======================================================== */
            <div style={{overflowX:"auto", width: "100%"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                <thead>
                  <tr>{["Cat","Product","Code","Expiry","Qty","Pricing","Price (RM)","Sold To","Notes","Status","Actions"].map(h=><th key={h} style={{background:"#f0ebe0",padding:"9px 12px",fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:"#888",textAlign:"left",borderBottom:"2px solid #e0d8c8"}}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const days = daysUntilExpiry(p.expiry);
                    const badge = expiryBadge(days);
                    const isEditing = editingId===p.id;
                    const rowBg = p.status==="sold"?{background:"#f9f9f7",opacity:0.6}:days!==null&&days<0?{background:"#fff5f5"}:days!==null&&days<=30?{background:"#fff9f0"}:days!==null&&days<=90?{background:"#fffdf5"}:{};
                    return (
                      <tr key={p.id} style={rowBg}>
                        <td style={td}><span style={catBadge(p.category)}>{p.category==='Skincare'?'SKIN':'SUPP'}</span></td>
                        <td style={td}><div style={{fontWeight:"600",color:"#1a1a2e"}}>{p.name}</div>{p.label&&<div style={{fontSize:"11px",color:"#aaa",marginTop:"2px"}}>{p.label}</div>}</td>
                        <td style={td}><span style={{fontSize:"11px",color:"#888",fontFamily:"monospace"}}>{p.code||"—"}</span></td>
                        <td style={td}>{isEditing?<input style={{...inp,width:"120px"}} value={p.expiry||""} onChange={e=>updateLocal(p.id,"expiry",e.target.value)} />:<div><div style={{fontSize:"12px",color:"#555",marginBottom:"3px"}}>{p.expiry||"—"}</div>{p.expiry&&<span style={{background:badge.bg,color:badge.color,padding:"2px 7px",borderRadius:"3px",fontSize:"10px",fontWeight:"700",display:"inline-block"}}>{badge.label}</span>}</div>}</td>
                        <td style={td}>{isEditing?<input style={{...inp,width:"55px"}} type="number" value={p.qty} onChange={e=>updateLocal(p.id,"qty",+e.target.value)} />:<span style={{fontSize:"17px",fontWeight:"700",color:p.qty===0?"#cc4444":p.qty<=2?"#f0b429":"#1a1a2e"}}>{p.qty}</span>}</td>
                        <td style={td}>{isEditing?<select style={sel} value={p.pricing} onChange={e=>updateLocal(p.id,"pricing",e.target.value)}>{PRICING_OPTIONS.map(o=><option key={o}>{o}</option>)}</select>:<span style={{fontSize:"11px",color:p.pricing==="FOC"?"#5a9a5a":p.pricing==="PWP"?"#c8963e":"#555",fontWeight:"600"}}>{p.pricing}</span>}</td>
                        <td style={td}>{isEditing?<input style={{...inp,width:"75px"}} value={p.price||""} onChange={e=>updateLocal(p.id,"price",e.target.value)} />:<span>{p.price?`RM ${p.price}`:"—"}</span>}</td>
                        <td style={td}>{isEditing?<input style={{...inp,width:"110px"}} value={p.soldTo||""} onChange={e=>updateLocal(p.id,"soldTo",e.target.value)} />:<span style={{color:"#555",fontSize:"12px"}}>{p.soldTo||"—"}</span>}</td>
                        <td style={td}>{isEditing?<input style={{...inp,width:"140px"}} value={p.notes||""} onChange={e=>updateLocal(p.id,"notes",e.target.value)} />:<span style={{color:"#888",fontSize:"11px"}}>{p.notes||"—"}</span>}</td>
                        <td style={td}>{isEditing?<select style={sel} value={p.status} onChange={e=>updateLocal(p.id,"status",e.target.value)}>{STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}</select>:<span style={statusBadge(p.status)}>{p.status}</span>}</td>
                        <td style={td}>{isEditing?<><button style={ab("#4caf7d")} onClick={()=>saveEdit(p)}>✓ Save</button><button style={ab("#888")} onClick={()=>setEditingId(null)}>Cancel</button></>:<><button style={ab("#c8963e")} onClick={()=>setEditingId(p.id)}>Edit</button><button style={ab("#5a9a5a")} onClick={()=>markSold(p)}>Sold</button><button style={ab("#cc4444")} onClick={()=>deleteProduct(p)}>✕</button></>}</td>
                      </tr>
                    );
                  })}
                  {filtered.length===0&&<tr><td colSpan={11} style={{textAlign:"center",padding:"40px",color:"#aaa"}}>No products found.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Shared Persistent Footer */}
      <div style={{padding:"16px 24px",background:"#f0ebe0",borderTop:"1px solid #e0d8c8",fontSize:"11px",color:"#a09a8f",textAlign:"center"}}>
        🔴 Expired · 🟠 &lt;30d · 🟡 &lt;90d · 🟢 Safe · All changes saved to Google Sheets
      </div>
    </div>
  );
}
