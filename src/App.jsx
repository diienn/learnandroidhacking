import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

const ROLES = {
  admin:           { label: "ADMIN",           color: "#ffffff" },
  moderator:       { label: "MOD",             color: "#22c55e" },
  verified_modder: { label: "VERIFIED MODDER", color: "#3b82f6" },
  og:              { label: "OG",              color: "#f59e0b" },
  contributor:     { label: "CONTRIBUTOR",     color: "#a855f7" },
  member:          { label: "MEMBER",          color: "#555555" },
};

const STAFF_ROLES  = ["admin","moderator"];
const LOUNGE_ROLES = ["admin","moderator","verified_modder","og","contributor"];

const isStaff    = r => STAFF_ROLES.includes(r);
const canMod     = r => r === "admin" || r === "moderator";
const canLounge  = r => LOUNGE_ROLES.includes(r);
const canViewCat = (slug, role) => {
  if (slug === "offtopic") return true;
  if (slug === "lounge")   return canLounge(role);
  return isStaff(role);
};
const canPostIn = (slug, role) => canViewCat(slug, role);

// ── POINTS CONFIG ─────────────────────────────────────────
const POINTS = {
  daily_login:    5,
  post_thread:   10,
  post_reply:     3,
  receive_react:  1,
};

// ── WORD FILTER ───────────────────────────────────────────
const BANNED_WORDS = [
  "nigger","nigga","faggot","retard","chink","spic","kike","tranny","ng","nga","porn","por","
  // add more as needed
];
const containsBannedWord = text => {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some(w => lower.includes(w));
};

const REACTIONS = ["+1","haha","fire","mind blown","love"];
const RD = { "+1":"+1","haha":"lol","fire":"fire","mind blown":"wtf","love":"love" };

const CATEGORIES = [
  { slug:"all",           label:"All",           viewRole:"member" },
  { slug:"announcements", label:"Announcements", viewRole:"staff"  },
  { slug:"guides",        label:"Guides",        viewRole:"staff"  },
  { slug:"youtube",       label:"YouTube",       viewRole:"staff"  },
  { slug:"showcase",      label:"Showcases",     viewRole:"staff"  },
  { slug:"mods",          label:"Mods",          viewRole:"staff"  },
  { slug:"templates",     label:"Templates",     viewRole:"staff"  },
  { slug:"help",          label:"Help",          viewRole:"staff"  },
  { slug:"lounge",        label:"Lounge",        viewRole:"lounge" },
  { slug:"offtopic",      label:"Off-Topic",     viewRole:"member" },
];

const ALL_TAGS = ["bnm","il2cpp","unity","dobby","openxr","quest","vr","vulkan","ndk","cmake","imgui","UE","frida","ghidra","metadata","arm64","hook","android","beginner","template","guide","crash","help","build"];

const timeAgo = iso => {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};
const fmt = n => n >= 1000 ? (n/1000).toFixed(1)+"k" : n;

// ── POINTS HELPERS ────────────────────────────────────────
async function awardPoints(userId, amount, reason) {
  try {
    await sb.from("points_log").insert({ user_id: userId, amount, reason });
    await sb.rpc("increment_points", { uid: userId, amt: amount });
  } catch(_) {
    // fallback if rpc not set up — just do a raw update via select+update
    const { data: p } = await sb.from("profiles").select("points").eq("id", userId).single();
    await sb.from("profiles").update({ points: (p?.points || 0) + amount }).eq("id", userId);
  }
}



export default function App() {
  const [session, setSession]         = useState(null);
  const [profile, setProfile]         = useState(null);
  const [view, setView]               = useState("home");
  const [thread, setThread]           = useState(null);
  const [activeCat, setActiveCat]     = useState("all");
  const [activeTag, setActiveTag]     = useState(null);
  const [search, setSearch]           = useState("");
  const [booting, setBooting]         = useState(true);
  const [pubProfileId, setPubProfile] = useState(null);
  const [dailyToast, setDailyToast]   = useState(false);

  // EXISTING useEffect (auth)
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      ...
    });
    ...
  }, []);

  // ADD THIS RIGHT HERE ↓
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#/user/")) {
      const username = hash.slice(7);
      sb.from("profiles").select("id").eq("username", username).single()
        .then(({ data }) => {
          if (data) { setPubProfile(data.id); setView("pubprofile"); }
        });
    } else if (hash.startsWith("#/thread/")) {
      const id = hash.slice(9);
      sb.from("threads").select("*").eq("id", id).single()
        .then(({ data }) => {
          if (data) { setThread(data); setView("thread"); }
        });
    }
  }, []);

  const loadProfile = async uid => { ... };


  const openThread = t => {
    window.location.hash = `/thread/${t.id}`;
    setThread(t); setView("thread");
  };

  const openProfile = id => {
    sb.from("profiles").select("username").eq("id", id).single()
      .then(({ data }) => {
        if (data) window.location.hash = `/user/${data.username}`;
      });
    setPubProfile(id); setView("pubprofile");
  };

  const goHome = () => {
    window.location.hash = "";
    setView("home"); setActiveTag(null); setSearch("");
  };

async function checkDailyLogin(userId) {
  const today = new Date().toISOString().split("T")[0];
  const { error } = await sb.from("daily_activity").insert({ user_id: userId, date: today });
  if (!error) {
    // new row = first login today
    await awardPoints(userId, POINTS.daily_login, "Daily login");
    return true; // got points
  }
  return false;
}

function renderBody(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const out = [];
  let inCode = false, codeLines = [];
  lines.forEach((line, i) => {
    if (line.startsWith("```")) {
      if (inCode) {
        out.push(<pre key={i} style={{background:"#0a0a0a",border:"1px solid #222",borderRadius:2,padding:"0.8rem 1rem",overflowX:"auto",fontFamily:"monospace",fontSize:12,color:"#22c55e",margin:"0.5rem 0",lineHeight:1.6}}>{codeLines.join("\n")}</pre>);
        codeLines=[]; inCode=false;
      } else inCode=true;
      return;
    }
    if (inCode) { codeLines.push(line); return; }
    const trimmed = line.trim();
    const isMedia = /^https?:\/\/\S+\.(gif|png|jpg|jpeg|webp)(\?\S*)?$/i.test(trimmed)||/^https?:\/\/(media\.tenor\.com|media\.giphy\.com|i\.imgur\.com)\S*$/i.test(trimmed);
    if (isMedia) { out.push(<div key={i} style={{margin:"0.6rem 0",maxWidth:480}}><img src={trimmed} alt="" style={{width:"100%",display:"block",borderRadius:2,border:"1px solid #222"}} loading="lazy"/></div>); return; }
    if (line.startsWith("# "))       out.push(<h2 key={i} style={{fontSize:"1.2rem",color:"#fff",margin:"0.8rem 0 0.3rem",fontWeight:700}}>{line.slice(2)}</h2>);
    else if (line.startsWith("## ")) out.push(<h3 key={i} style={{fontSize:"1rem",color:"#ccc",margin:"0.6rem 0 0.2rem",fontWeight:600}}>{line.slice(3)}</h3>);
    else if (line.startsWith("- "))  out.push(<div key={i} style={{color:"#888",paddingLeft:"1rem",marginBottom:2}}>- {line.slice(2)}</div>);
    else if (!trimmed)               out.push(<div key={i} style={{height:"0.4rem"}}/>);
    else {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      out.push(<p key={i} style={{color:"#999",marginBottom:2,lineHeight:1.7,fontSize:13.5}}>{parts.map((p,j)=>p.startsWith("**")&&p.endsWith("**")?<strong key={j} style={{color:"#ccc",fontWeight:600}}>{p.slice(2,-2)}</strong>:p)}</p>);
    }
  });
  return out;
}

function genCaptcha() {
  const a = Math.floor(Math.random()*15)+1;
  const b = Math.floor(Math.random()*15)+1;
  return { a, b, answer: a+b };
}

// ══════════════════════════════════════════════════════════
//  ROOT
// ══════════════════════════════════════════════════════════
export default function App() {
  const [session, setSession]         = useState(null);
  const [profile, setProfile]         = useState(null);
  const [view, setView]               = useState("home");
  const [thread, setThread]           = useState(null);
  const [activeCat, setActiveCat]     = useState("all");
  const [activeTag, setActiveTag]     = useState(null);
  const [search, setSearch]           = useState("");
  const [booting, setBooting]         = useState(true);
  const [pubProfileId, setPubProfile] = useState(null); // for public profile view
  const [dailyToast, setDailyToast]   = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id);
      else setBooting(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) loadProfile(s.user.id);
      else { setProfile(null); setBooting(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async uid => {
    const { data } = await sb.from("profiles").select("*").eq("id", uid).single();
    setProfile(data);
    setBooting(false);
    // check daily login points
    const got = await checkDailyLogin(uid);
    if (got) setDailyToast(true);
  };

  const openThread   = t  => { setThread(t); setView("thread"); };
  const openProfile  = id => { setPubProfile(id); setView("pubprofile"); };
  const goHome       = () => { setView("home"); setActiveTag(null); setSearch(""); };

  if (booting) return <Splash/>;
  if (!session) return <LoginPage/>;
  if (profile?.banned) return <BannedPage/>;

  return (
    <Layout profile={profile} view={view} setView={setView} search={search} setSearch={setSearch} goHome={goHome}>
      {dailyToast && (
        <div className="fi" style={{background:"#0f2d1a",border:"1px solid #166534",padding:"8px 14px",marginBottom:"1rem",fontSize:11,color:"#22c55e",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>+{POINTS.daily_login} points for logging in today!</span>
          <button onClick={()=>setDailyToast(false)} style={{background:"none",border:"none",color:"#22c55e",fontSize:14,cursor:"pointer"}}>×</button>
        </div>
      )}
      {view==="home"       && <HomePage onSelectCat={s=>{setActiveCat(s);setView("forum");}} profile={profile} onOpenProfile={openProfile}/>}
      {view==="forum"      && <ForumView profile={profile} activeCat={activeCat} setActiveCat={setActiveCat} activeTag={activeTag} setActiveTag={setActiveTag} search={search} onOpenThread={openThread} onNew={()=>setView("new")}/>}
      {view==="thread"     && thread && <ThreadView initThread={thread} profile={profile} onBack={()=>setView("forum")} onOpenProfile={openProfile}/>}
      {view==="new"        && <NewThreadView profile={profile} activeCat={activeCat} onBack={()=>setView("forum")} onCreated={t=>{setThread(t);setView("thread");}} onPointsEarned={()=>loadProfile(session.user.id)}/>}
      {view==="admin"      && canMod(profile?.role) && <AdminView profile={profile}/>}
      {view==="profile"    && <ProfileView profile={profile} onOpenThread={openThread} onProfileUpdate={()=>loadProfile(session.user.id)} onOpenProfile={openProfile}/>}
      {view==="pubprofile" && pubProfileId && <PublicProfileView userId={pubProfileId} currentProfile={profile} onOpenThread={openThread} onBack={()=>setView("forum")}/>}
      {view==="market"     && <MarketView profile={profile} onOpenThread={openThread} onPointsChanged={()=>loadProfile(session.user.id)}/>}
    </Layout>
  );
}

function BannedPage() {
  return (
    <div style={{minHeight:"100vh",background:"#000",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace"}}>
      <div style={{fontSize:"1.1rem",color:"#ef4444",fontWeight:700,marginBottom:8}}>Account Banned</div>
      <div style={{fontSize:12,color:"#555",marginBottom:"1.5rem"}}>You have been banned from this forum.</div>
      <button onClick={()=>sb.auth.signOut()} style={{background:"none",border:"1px solid #333",padding:"6px 16px",color:"#555",fontSize:11,fontFamily:"monospace",cursor:"pointer"}}>Sign Out</button>
    </div>
  );
}

// ── LOGIN ──────────────────────────────────────────────────
function LoginPage() {
  const [mode, setMode]         = useState("login");
  const [email, setEmail]       = useState("");
  const [pass, setPass]         = useState("");
  const [uname, setUname]       = useState("");
  const [err, setErr]           = useState("");
  const [busy, setBusy]         = useState(false);
  const [captcha, setCaptcha]   = useState(genCaptcha);
  const [capInput, setCapInput] = useState("");

  const switchMode = m => { setMode(m); setErr(""); setCapInput(""); setCaptcha(genCaptcha()); };

  const submit = async () => {
    setErr("");
    if (mode === "signup") {
      if (uname.trim().length < 3)  { setErr("Username must be at least 3 characters."); return; }
      if (uname.trim().length > 20) { setErr("Username max 20 characters."); return; }
      if (!/^[a-zA-Z0-9_]+$/.test(uname.trim())) { setErr("Username: letters, numbers, underscores only."); return; }
      if (parseInt(capInput) !== captcha.answer) { setErr("Wrong answer."); setCaptcha(genCaptcha()); setCapInput(""); return; }
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await sb.auth.signUp({ email, password: pass, options: { data: { username: uname.trim() } } });
        if (error) { setErr(error.message); return; }
        setErr("Check your email to confirm your account.");
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) { setErr(error.message); return; }
      }
    } finally { setBusy(false); }
  };

  const isGreen = err.includes("Check your email");

  return (
    <div style={{minHeight:"100vh",background:"#000",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace"}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input{outline:none;font-family:monospace}`}</style>
      <div style={{marginBottom:"2.5rem",textAlign:"center"}}>
        <div style={{fontSize:"1.4rem",fontWeight:700,color:"#fff",marginBottom:6}}>LearnAndroidHacking</div>
        <div style={{fontSize:11,color:"#444",letterSpacing:"0.15em",textTransform:"uppercase"}}>Free Android Modding Community</div>
      </div>
      <div style={{width:"100%",maxWidth:340,background:"#0a0a0a",border:"1px solid #1a1a1a",padding:"2rem"}}>
        <div style={{display:"flex",borderBottom:"1px solid #1a1a1a",marginBottom:"1.5rem"}}>
          {["login","signup"].map(m=>(
            <button key={m} onClick={()=>switchMode(m)}
              style={{flex:1,background:"none",border:"none",borderBottom:`2px solid ${mode===m?"#22c55e":"transparent"}`,padding:"0.5rem",fontSize:12,color:mode===m?"#fff":"#555",fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:-1,cursor:"pointer"}}>
              {m==="login"?"Sign In":"Register"}
            </button>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"0.8rem"}}>
          {mode==="signup"&&(
            <div>
              <LabeledInput label="Username (max 20)" value={uname} onChange={v=>setUname(v.slice(0,20))} placeholder="your_handle"/>
              <div style={{fontSize:9,color:"#333",marginTop:3,textAlign:"right"}}>{uname.length}/20</div>
            </div>
          )}
          <LabeledInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com"/>
          <LabeledInput label="Password" type="password" value={pass} onChange={setPass} placeholder="••••••••"/>
          {mode==="signup"&&(
            <div>
              <div style={{fontSize:10,color:"#555",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Verify you're human</div>
              <div style={{background:"#000",border:"1px solid #1a1a1a",padding:"0.8rem",marginBottom:6,textAlign:"center"}}>
                <span style={{fontSize:"1.1rem",color:"#fff",fontWeight:700}}>{captcha.a} + {captcha.b} = ?</span>
              </div>
              <input value={capInput} onChange={e=>setCapInput(e.target.value)} placeholder="answer"
                style={{width:"100%",background:"#000",border:"1px solid #1a1a1a",padding:"7px 10px",color:"#fff",fontSize:12}}/>
            </div>
          )}
          {err&&<div style={{fontSize:11,color:isGreen?"#22c55e":"#f87171",padding:"6px 8px",background:"#111",border:`1px solid ${isGreen?"#166534":"#7f1d1d"}`}}>{err}</div>}
          <button onClick={submit} disabled={busy}
            style={{background:"#22c55e",color:"#000",border:"none",padding:"10px",fontSize:12,fontFamily:"monospace",fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",cursor:busy?"not-allowed":"pointer",opacity:busy?0.6:1,marginTop:4}}>
            {busy?"...":(mode==="login"?"Sign In":"Create Account")}
          </button>
        </div>
      </div>
      <div style={{marginTop:"1.5rem",fontSize:11,color:"#333"}}>Free forever. No paywalls.</div>
    </div>
  );
}

// ── LAYOUT ─────────────────────────────────────────────────
function Layout({ children, profile, view, setView, search, setSearch, goHome }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const logout = async () => { await sb.auth.signOut(); };
  return (
    <div style={{minHeight:"100vh",background:"#000",color:"#ccc",fontFamily:"monospace"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#000}::-webkit-scrollbar-thumb{background:#222}
        input,textarea,select{outline:none;font-family:monospace}textarea{resize:vertical}
        @keyframes fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.fi{animation:fadein 0.18s ease}
        @keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin 0.7s linear infinite}
        button{cursor:pointer}.row:hover{background:#0a0a0a !important}.catbtn:hover{color:#fff !important}
      `}</style>
      <nav style={{background:"#000",borderBottom:"1px solid #1a1a1a",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"0 1.2rem",height:48,display:"flex",alignItems:"center",gap:"1rem"}}>
          <button onClick={goHome} style={{background:"none",border:"none",fontSize:"0.95rem",fontWeight:700,color:"#fff",fontFamily:"monospace"}}>LAH</button>
          <span style={{color:"#222",fontSize:18}}>|</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>setView("forum")} placeholder="search..."
            style={{flex:1,maxWidth:320,background:"#0a0a0a",border:"1px solid #1a1a1a",padding:"4px 10px",color:"#ccc",fontSize:12}}/>
          <div style={{display:"flex",gap:8,alignItems:"center",marginLeft:"auto"}}>
            <NavBtn label="Forum"  active={["forum","thread","new"].includes(view)} onClick={()=>setView("forum")}/>
            <NavBtn label="Market" active={view==="market"} onClick={()=>setView("market")}/>
            {canMod(profile?.role)&&<NavBtn label="Mod Panel" active={view==="admin"} onClick={()=>setView("admin")}/>}
            <div style={{position:"relative"}}>
              <button onClick={()=>setMenuOpen(o=>!o)}
                style={{background:"none",border:"1px solid #1a1a1a",padding:"4px 10px",color:"#ccc",fontSize:11,fontFamily:"monospace",display:"flex",alignItems:"center",gap:7}}>
                <Dot role={profile?.role}/>
                {profile?.username}
                <span style={{color:"#f59e0b",fontSize:10,marginLeft:2}}>⬡ {profile?.points||0}</span>
              </button>
              {menuOpen&&(
                <div onClick={()=>setMenuOpen(false)} style={{position:"absolute",right:0,top:"calc(100% + 2px)",background:"#0a0a0a",border:"1px solid #1a1a1a",minWidth:140,zIndex:200}} className="fi">
                  <DDBtn label="Profile"  onClick={()=>setView("profile")}/>
                  <DDBtn label="Sign Out" onClick={logout} dim/>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <div style={{maxWidth:1200,margin:"0 auto",padding:"1.5rem 1.2rem"}}>{children}</div>
    </div>
  );
}

function NavBtn({label,active,onClick}) {
  return <button onClick={onClick} style={{background:"none",border:"none",fontSize:11,color:active?"#fff":"#555",fontFamily:"monospace",letterSpacing:"0.08em",textTransform:"uppercase",padding:"4px 0",borderBottom:`1px solid ${active?"#22c55e":"transparent"}`}}>{label}</button>;
}
function DDBtn({label,onClick,dim}) {
  return <button onClick={onClick} className="row" style={{display:"block",width:"100%",background:"none",border:"none",padding:"8px 1rem",fontSize:11,color:dim?"#555":"#ccc",fontFamily:"monospace",textAlign:"left"}}>{label}</button>;
}
function Dot({role}) {
  return <span style={{width:6,height:6,borderRadius:"50%",background:ROLES[role]?.color||"#555",display:"inline-block",flexShrink:0}}/>;
}

// ── HOME ──────────────────────────────────────────────────
function HomePage({ onSelectCat, profile, onOpenProfile }) {
  const [stats, setStats]   = useState({threads:0,members:0,replies:0});
  const [latest, setLatest] = useState([]);

  useEffect(()=>{
    Promise.all([
      sb.from("threads").select("*",{count:"exact",head:true}),
      sb.from("profiles").select("*",{count:"exact",head:true}),
      sb.from("replies").select("*",{count:"exact",head:true}),
      sb.from("threads").select("id,title,tags,created_at,categories(slug,label),profiles(id,username,role)").order("created_at",{ascending:false}).limit(5),
    ]).then(([{count:t},{count:m},{count:r},{data:l}])=>{
      setStats({threads:t||0,members:m||0,replies:r||0});
      setLatest(l||[]);
    });
  },[]);

  const visibleCats = CATEGORIES.filter(c=>c.slug!=="all"&&canViewCat(c.slug,profile?.role));

  return (
    <div className="fi">
      <div style={{paddingBottom:"2rem",marginBottom:"2rem",borderBottom:"1px solid #1a1a1a"}}>
        <div style={{fontSize:11,color:"#333",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8}}>Free Android Modding Community</div>
        <h1 style={{fontSize:"1.8rem",color:"#fff",fontWeight:700,marginBottom:"0.5rem"}}>LearnAndroidHacking</h1>
        <p style={{fontSize:13,color:"#555",lineHeight:1.7,maxWidth:480}}>IL2CPP, native hooking, VR modding, reverse engineering. All free. No paywalls.</p>
        <div style={{display:"flex",gap:"2rem",marginTop:"1.2rem",flexWrap:"wrap"}}>
          {[["Threads",fmt(stats.threads)],["Members",fmt(stats.members)],["Posts",fmt(stats.threads+stats.replies)]].map(([l,v])=>(
            <div key={l}>
              <div style={{fontSize:"1.2rem",color:"#22c55e",fontWeight:700}}>{v}</div>
              <div style={{fontSize:10,color:"#333",textTransform:"uppercase",letterSpacing:"0.1em",marginTop:1}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{marginBottom:"2rem"}}>
        <SLabel>Categories</SLabel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:"1px",border:"1px solid #1a1a1a",marginTop:10}}>
          {visibleCats.map(cat=>(
            <button key={cat.slug} onClick={()=>onSelectCat(cat.slug)}
              style={{background:"#0a0a0a",border:"none",padding:"1.1rem 1rem",textAlign:"left",transition:"background 0.1s"}}
              onMouseEnter={e=>e.currentTarget.style.background="#111"}
              onMouseLeave={e=>e.currentTarget.style.background="#0a0a0a"}>
              <div style={{fontSize:12,color:"#fff",fontWeight:700,marginBottom:4}}>{cat.label}</div>
              <div style={{fontSize:10,color:"#333"}}>{cat.viewRole==="staff"?"Staff only":cat.viewRole==="lounge"?"Lounge access":"Open"}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <SLabel>Latest Posts</SLabel>
        <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:1}}>
          {latest.filter(t=>canViewCat(t.categories?.slug,profile?.role)).map(t=>(
            <div key={t.id} style={{background:"#0a0a0a",padding:"0.7rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem",flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:13,color:"#ddd",marginBottom:3}}>{t.title}</div>
                <div style={{fontSize:11,color:"#333",display:"flex",gap:8}}>
                  <span onClick={()=>onOpenProfile(t.profiles?.id)} style={{color:ROLES[t.profiles?.role]?.color||"#555",cursor:"pointer",textDecoration:"underline"}}>{t.profiles?.username}</span>
                  <span>{t.categories?.label}</span>
                  <span>{timeAgo(t.created_at)}</span>
                </div>
              </div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{(t.tags||[]).slice(0,3).map(tg=><TagChip key={tg} t={tg}/>)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── FORUM VIEW ─────────────────────────────────────────────
function ForumView({ profile, activeCat, setActiveCat, activeTag, setActiveTag, search, onOpenThread, onNew }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort]       = useState("latest");

  const load = useCallback(async () => {
    setLoading(true);
    let q = sb.from("threads")
      .select("id,title,tags,created_at,views,pinned,locked,categories(id,slug,label),profiles(username,role),replies(count)")
      .order("pinned",{ascending:false});
    if (activeCat !== "all") {
      const { data: catRow } = await sb.from("categories").select("id").eq("slug",activeCat).single();
      if (catRow) q = q.eq("category_id",catRow.id);
    }
    if (activeTag) q = q.contains("tags",[activeTag]);
    if (search)    q = q.ilike("title",`%${search}%`);
    q = sort==="views" ? q.order("views",{ascending:false}) : q.order("created_at",{ascending:false});
    const { data } = await q.limit(60);
    setThreads((data||[]).filter(t=>canViewCat(t.categories?.slug,profile?.role)));
    setLoading(false);
  },[activeCat,activeTag,search,sort,profile?.role]);

  useEffect(()=>{load();},[load]);

  const visibleCats = CATEGORIES.filter(c=>c.slug==="all"||canViewCat(c.slug,profile?.role));

  return (
    <div style={{display:"flex",gap:"1.5rem"}} className="fi">
      <aside style={{width:160,flexShrink:0}}>
        <SLabel>Categories</SLabel>
        <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:1}}>
          {visibleCats.map(c=>(
            <button key={c.slug} onClick={()=>{setActiveCat(c.slug);setActiveTag(null);}} className="catbtn"
              style={{background:activeCat===c.slug?"#111":"none",border:"none",padding:"5px 8px",textAlign:"left",fontSize:11,color:activeCat===c.slug?"#fff":"#555",fontFamily:"monospace",borderLeft:`2px solid ${activeCat===c.slug?"#22c55e":"transparent"}`,transition:"all 0.1s"}}>
              {c.label}
            </button>
          ))}
        </div>
        <div style={{marginTop:"1.5rem"}}>
          <SLabel>Tags</SLabel>
          <div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:3}}>
            {ALL_TAGS.map(t=><TagChip key={t} t={t} active={activeTag===t} onClick={()=>setActiveTag(activeTag===t?null:t)}/>)}
          </div>
        </div>
      </aside>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem",gap:8,flexWrap:"wrap"}}>
          <h2 style={{fontSize:"1rem",color:"#fff",fontWeight:700}}>{activeTag?`#${activeTag}`:search?`"${search}"`:CATEGORIES.find(c=>c.slug===activeCat)?.label||"Forum"}</h2>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <select value={sort} onChange={e=>setSort(e.target.value)} style={{background:"#0a0a0a",border:"1px solid #1a1a1a",color:"#555",padding:"4px 8px",fontSize:11}}>
              <option value="latest">Latest</option>
              <option value="views">Most Viewed</option>
            </select>
            {canPostIn(activeCat==="all"?"offtopic":activeCat,profile?.role)&&(
              <button onClick={onNew} style={{background:"#22c55e",color:"#000",border:"none",padding:"5px 14px",fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>New Thread</button>
            )}
          </div>
        </div>
        {loading?<Spinner/>:threads.length===0
          ?<div style={{padding:"3rem",textAlign:"center",fontSize:11,color:"#333"}}>no threads found</div>
          :<div style={{border:"1px solid #1a1a1a"}}>{threads.map((t,i)=><ThreadRow key={t.id} t={t} onClick={()=>onOpenThread(t)} last={i===threads.length-1}/>)}</div>
        }
      </div>
    </div>
  );
}

function ThreadRow({t,onClick,last}) {
  const rc = t.replies?.[0]?.count??0;
  return (
    <div onClick={onClick} className="row" style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"0.8rem",alignItems:"center",padding:"0.85rem 1rem",borderBottom:last?"none":"1px solid #1a1a1a",cursor:"pointer",background:"#000",position:"relative",transition:"background 0.1s"}}>
      {t.pinned&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:2,background:"#22c55e"}}/>}
      <div style={{minWidth:0,paddingLeft:t.pinned?8:0}}>
        <div style={{display:"flex",gap:5,marginBottom:3,alignItems:"center",flexWrap:"wrap"}}>
          {t.pinned&&<Pill label="PINNED" green/>}
          {t.locked&&<Pill label="LOCKED" dim/>}
          {t.categories&&<Pill label={t.categories.label}/>}
        </div>
        <div style={{fontSize:13,color:"#ddd",fontWeight:600,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.title}</div>
        <div style={{display:"flex",alignItems:"center",gap:"0.6rem",flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:ROLES[t.profiles?.role]?.color||"#555"}}>{t.profiles?.username}</span>
          <span style={{fontSize:11,color:"#222"}}>·</span>
          <span style={{fontSize:11,color:"#333"}}>{timeAgo(t.created_at)}</span>
          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{(t.tags||[]).slice(0,4).map(tg=><TagChip key={tg} t={tg}/>)}</div>
        </div>
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div style={{fontSize:11,color:"#444"}}>{rc} replies</div>
        <div style={{fontSize:10,color:"#2a2a2a",marginTop:2}}>{fmt(t.views||0)} views</div>
      </div>
    </div>
  );
}

// ── THREAD VIEW ────────────────────────────────────────────
function ThreadView({ initThread, profile, onBack, onOpenProfile }) {
  const [thread, setThread]   = useState(null);
  const [replies, setReplies] = useState([]);
  const [body, setBody]       = useState("");
  const [busy, setBusy]       = useState(false);
  const [loading, setLoading] = useState(true);
  const [modLog, setModLog]   = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [filterErr, setFilterErr] = useState("");
  const lastPost = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: th }, { data: rpl }, { data: log }] = await Promise.all([
      sb.from("threads").select("*,categories(slug,label),profiles(id,username,role,avatar_url,bio,points)").eq("id",initThread.id).single(),
      sb.from("replies").select("*,profiles(id,username,role,avatar_url)").eq("thread_id",initThread.id).order("created_at",{ascending:true}),
      sb.from("mod_log").select("*,profiles(username,role)").eq("thread_id",initThread.id).order("created_at",{ascending:false}).limit(20),
    ]);
    setThread(th); setReplies(rpl||[]); setModLog(log||[]);
    await sb.from("thread_views").insert({thread_id:initThread.id});
    setLoading(false);
  },[initThread.id]);

  useEffect(()=>{load();},[load]);

  const logAction = async (action,detail="") => {
    try { await sb.from("mod_log").insert({thread_id:thread.id,mod_id:profile.id,action,detail}); } catch(_){}
  };

  const postReply = async () => {
    if (!body.trim()||thread?.locked) return;
    setFilterErr("");
    if (containsBannedWord(body)) { setFilterErr("Your reply contains prohibited content."); return; }
    const now = Date.now();
    if (now - lastPost.current < 15000) { setFilterErr("Please wait 15 seconds before posting again."); return; }
    lastPost.current = now;
    setBusy(true);
    const { error } = await sb.from("replies").insert({thread_id:thread.id,author_id:profile.id,body:body.trim()});
    if (!error) {
      setBody("");
      await awardPoints(profile.id, POINTS.post_reply, "Posted reply");
      await load();
    }
    setBusy(false);
  };

  const togglePin  = async()=>{ await sb.from("threads").update({pinned:!thread.pinned}).eq("id",thread.id); await logAction(thread.pinned?"unpin":"pin"); load(); };
  const toggleLock = async()=>{ await sb.from("threads").update({locked:!thread.locked}).eq("id",thread.id); await logAction(thread.locked?"unlock":"lock"); load(); };
  const del        = async()=>{ if(window.confirm("Delete this thread?")){ await sb.from("threads").delete().eq("id",thread.id); await logAction("delete",thread.title); onBack(); } };
  const delReply   = async rid=>{ await sb.from("replies").delete().eq("id",rid); await logAction("delete_reply"); load(); };

  const reportContent = async (type, id) => {
    await sb.from("reports").insert({ reporter_id: profile.id, target_type: type, target_id: id, reason: "User report" });
    alert("Reported. Mods will review this.");
  };

  if (loading||!thread) return <Spinner/>;
  const isMod = canMod(profile?.role);

  return (
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem",flexWrap:"wrap",gap:8}}>
        <button onClick={onBack} style={{background:"none",border:"none",fontSize:11,color:"#555",fontFamily:"monospace"}}>back to forum</button>
        {isMod&&modLog.length>0&&(
          <button onClick={()=>setShowLog(!showLog)} style={{background:"none",border:"1px solid #1a1a1a",padding:"2px 10px",fontSize:10,color:"#555",fontFamily:"monospace"}}>
            {showLog?"hide":"show"} mod log ({modLog.length})
          </button>
        )}
      </div>

      {showLog&&isMod&&(
        <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a",padding:"0.8rem 1rem",marginBottom:"0.8rem"}}>
          <div style={{fontSize:10,color:"#555",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Mod Log</div>
          {modLog.map((l,i)=>(
            <div key={i} style={{fontSize:10,color:"#444",padding:"3px 0",borderBottom:i<modLog.length-1?"1px solid #111":"none",display:"flex",gap:8}}>
              <span style={{color:ROLES[l.profiles?.role]?.color||"#555"}}>{l.profiles?.username}</span>
              <span style={{color:"#22c55e"}}>{l.action}</span>
              {l.detail&&<span style={{color:"#333"}}>{l.detail}</span>}
              <span style={{marginLeft:"auto",color:"#222"}}>{timeAgo(l.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a"}}>
        <div style={{padding:"1.2rem 1.4rem",borderBottom:"1px solid #1a1a1a"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"0.8rem"}}>
            <div>
              <div style={{display:"flex",gap:5,marginBottom:6,flexWrap:"wrap"}}>
                {thread.pinned&&<Pill label="PINNED" green/>}
                {thread.locked&&<Pill label="LOCKED" dim/>}
                {thread.categories&&<Pill label={thread.categories.label}/>}
              </div>
              <h1 style={{fontSize:"1.2rem",color:"#fff",fontWeight:700,lineHeight:1.3}}>{thread.title}</h1>
            </div>
            <div style={{display:"flex",gap:5,flexShrink:0}}>
              {isMod&&<>
                <MBtn label={thread.pinned?"Unpin":"Pin"}   onClick={togglePin}/>
                <MBtn label={thread.locked?"Unlock":"Lock"} onClick={toggleLock}/>
                <MBtn label="Delete" onClick={del} red/>
              </>}
              {profile.id!==thread.author_id&&(
                <MBtn label="Report" onClick={()=>reportContent("thread",thread.id)}/>
              )}
            </div>
          </div>
        </div>

        <div style={{padding:"1rem 1.4rem",borderBottom:"1px solid #1a1a1a",display:"flex",gap:"0.8rem",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:"0.8rem",alignItems:"center",cursor:"pointer"}} onClick={()=>onOpenProfile(thread.profiles?.id)}>
            <Avi profile={thread.profiles} size={36}/>
            <div>
              <div style={{fontSize:12,color:ROLES[thread.profiles?.role]?.color||"#555",fontWeight:700,textDecoration:"underline"}}>{thread.profiles?.username}</div>
              <div style={{fontSize:10,color:ROLES[thread.profiles?.role]?.color||"#555"}}>[{ROLES[thread.profiles?.role]?.label||"MEMBER"}]</div>
              {thread.profiles?.bio&&<div style={{fontSize:10,color:"#444",marginTop:2,maxWidth:300}}>{thread.profiles.bio}</div>}
            </div>
          </div>
          <div style={{fontSize:10,color:"#333",textAlign:"right"}}>
            <div>{new Date(thread.created_at).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"})}</div>
            <div style={{marginTop:2}}>{fmt(thread.views||0)} views · {replies.length} replies</div>
            <div style={{color:"#f59e0b",marginTop:2}}>⬡ {thread.profiles?.points||0} pts</div>
          </div>
        </div>

        <div style={{padding:"1.2rem 1.4rem"}}>{renderBody(thread.body)}</div>
        <div style={{padding:"0.8rem 1.4rem",borderTop:"1px solid #111",display:"flex",gap:4,flexWrap:"wrap"}}>
          {(thread.tags||[]).map(tg=><TagChip key={tg} t={tg}/>)}
        </div>
        <div style={{padding:"0.5rem 1.4rem 1rem",borderTop:"1px solid #111"}}>
          <ReactBar type="thread" id={thread.id} profile={profile} authorId={thread.author_id}/>
        </div>
      </div>

      {replies.map((r,i)=>(
        <div key={r.id} style={{background:i%2===0?"#000":"#050505",border:"1px solid #1a1a1a",borderTop:"none"}}>
          <div style={{padding:"0.9rem 1.4rem",display:"flex",gap:"0.8rem",alignItems:"flex-start"}}>
            <div style={{cursor:"pointer"}} onClick={()=>onOpenProfile(r.profiles?.id)}>
              <Avi profile={r.profiles} size={28}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                <span onClick={()=>onOpenProfile(r.profiles?.id)} style={{fontSize:12,color:ROLES[r.profiles?.role]?.color||"#555",fontWeight:700,cursor:"pointer",textDecoration:"underline"}}>{r.profiles?.username}</span>
                <span style={{fontSize:10,color:ROLES[r.profiles?.role]?.color||"#555"}}>[{ROLES[r.profiles?.role]?.label||"MEMBER"}]</span>
                <span style={{fontSize:10,color:"#222"}}>·</span>
                <span style={{fontSize:10,color:"#333"}}>{timeAgo(r.created_at)}</span>
                <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                  {profile?.id!==r.author_id&&(
                    <button onClick={()=>reportContent("reply",r.id)} style={{background:"none",border:"none",fontSize:10,color:"#333",fontFamily:"monospace"}}>report</button>
                  )}
                  {(isMod||profile?.id===r.author_id)&&(
                    <button onClick={()=>delReply(r.id)} style={{background:"none",border:"none",fontSize:10,color:"#333",fontFamily:"monospace"}}>delete</button>
                  )}
                </div>
              </div>
              {renderBody(r.body)}
              <div style={{marginTop:6}}><ReactBar type="reply" id={r.id} profile={profile} authorId={r.author_id}/></div>
            </div>
          </div>
        </div>
      ))}

      <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a",borderTop:"none",padding:"1rem 1.4rem"}}>
        {thread.locked?(
          <div style={{fontSize:11,color:"#444",textAlign:"center",padding:"0.8rem"}}>Thread is locked.</div>
        ):(
          <>
            <div style={{fontSize:10,color:"#333",marginBottom:6,letterSpacing:"0.1em",textTransform:"uppercase"}}>
              Reply as <span style={{color:ROLES[profile?.role]?.color||"#555"}}>{profile?.username}</span>
              <span style={{marginLeft:8,color:"#222"}}>— paste a GIF url on its own line to embed</span>
            </div>
            <textarea value={body} onChange={e=>setBody(e.target.value)} rows={5} placeholder="Write your reply..."
              style={{width:"100%",background:"#000",border:"1px solid #1a1a1a",padding:"0.6rem 0.8rem",color:"#ccc",fontSize:12,lineHeight:1.7}}/>
            {filterErr&&<div style={{fontSize:11,color:"#f87171",marginTop:4}}>{filterErr}</div>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
              <span style={{fontSize:10,color:"#333"}}>+{POINTS.post_reply} pts for replying</span>
              <button onClick={postReply} disabled={!body.trim()||busy}
                style={{background:body.trim()&&!busy?"#22c55e":"#111",color:body.trim()&&!busy?"#000":"#333",border:"none",padding:"6px 18px",fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>
                {busy?"...":"Post Reply"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── REACTIONS ─────────────────────────────────────────────
function ReactBar({ type, id, profile, authorId }) {
  const [counts, setCounts] = useState({});
  const load = useCallback(async()=>{
    const {data} = await sb.from("reactions").select("emoji,user_id").eq("target_type",type).eq("target_id",id);
    const map={};
    (data||[]).forEach(r=>{ if(!map[r.emoji]) map[r.emoji]={count:0,mine:false}; map[r.emoji].count++; if(r.user_id===profile?.id) map[r.emoji].mine=true; });
    setCounts(map);
  },[type,id,profile?.id]);
  useEffect(()=>{load();},[load]);
  const react = async emoji=>{
    if(!profile) return;
    if(counts[emoji]?.mine) {
      await sb.from("reactions").delete().eq("user_id",profile.id).eq("target_type",type).eq("target_id",id).eq("emoji",emoji);
    } else {
      await sb.from("reactions").insert({user_id:profile.id,target_type:type,target_id:id,emoji});
      // award point to content author
      if (authorId && authorId !== profile.id) {
        await awardPoints(authorId, POINTS.receive_react, "Received reaction");
      }
    }
    load();
  };
  return (
    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
      {REACTIONS.map(e=>{ const c=counts[e]; const mine=c?.mine;
        return <button key={e} onClick={()=>react(e)} style={{background:mine?"#0f2d1a":"#0a0a0a",border:`1px solid ${mine?"#22c55e55":"#1a1a1a"}`,padding:"2px 8px",fontSize:10,color:mine?"#22c55e":"#444",display:"flex",gap:4,alignItems:"center"}}>
          {RD[e]}{c?.count?<span style={{color:mine?"#22c55e":"#333"}}>{c.count}</span>:null}
        </button>;
      })}
    </div>
  );
}

// ── NEW THREAD ─────────────────────────────────────────────
function NewThreadView({ profile, activeCat, onBack, onCreated, onPointsEarned }) {
  const [title,setTitle] = useState("");
  const [body,setBody]   = useState("");
  const [catSlug,setCat] = useState(()=>{
    const first = CATEGORIES.filter(c=>c.slug!=="all"&&canPostIn(c.slug,profile?.role))[0];
    if (activeCat!=="all"&&canPostIn(activeCat,profile?.role)) return activeCat;
    return first?.slug||"offtopic";
  });
  const [tags,setTags]   = useState([]);
  const [tagInput,setTI] = useState("");
  const [busy,setBusy]   = useState(false);
  const [err,setErr]     = useState("");

  const addTag = t=>{ if(!tags.includes(t)&&tags.length<8) setTags([...tags,t]); };
  const rmTag  = t=>setTags(tags.filter(x=>x!==t));
  const onTK   = e=>{ const v=e.target.value; if(v.endsWith(" ")||v.endsWith(",")){ const c=v.trim().replace(/,/g,"").toLowerCase().replace(/[^a-z0-9-]/g,""); if(c) addTag(c); setTI(""); } else setTI(v); };

  const allowedCats = CATEGORIES.filter(c=>c.slug!=="all"&&canPostIn(c.slug,profile?.role));

  const submit = async () => {
    if (!title.trim()||!body.trim()) return;
    if (containsBannedWord(title)||containsBannedWord(body)) { setErr("Your post contains prohibited content."); return; }
    if (!canPostIn(catSlug,profile?.role)) { setErr("You don't have permission to post here."); return; }
    setErr(""); setBusy(true);
    const { data: catRow, error: catErr } = await sb.from("categories").select("id").eq("slug",catSlug).single();
    if (catErr||!catRow) { setErr("Category not found."); setBusy(false); return; }
    const { data, error } = await sb.from("threads").insert({
      author_id: profile.id, category_id: catRow.id,
      title: title.trim(), body: body.trim(), tags,
    }).select("*").single();
    if (error) { setErr(error.message); setBusy(false); return; }
    await awardPoints(profile.id, POINTS.post_thread, "Posted thread");
    onPointsEarned?.();
    setBusy(false);
    onCreated(data);
  };

  return (
    <div className="fi" style={{maxWidth:760}}>
      <button onClick={onBack} style={{background:"none",border:"none",fontSize:11,color:"#555",marginBottom:"1rem"}}>back</button>
      <h2 style={{fontSize:"1rem",color:"#fff",fontWeight:700,marginBottom:"1.2rem"}}>New Thread</h2>
      <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a",padding:"1.4rem",display:"flex",flexDirection:"column",gap:"1rem"}}>
        <FRow label="Title">
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Thread title"
            style={{width:"100%",background:"#000",border:"1px solid #1a1a1a",padding:"7px 10px",color:"#fff",fontSize:13}}/>
        </FRow>
        <FRow label="Category">
          <select value={catSlug} onChange={e=>setCat(e.target.value)}
            style={{width:"100%",background:"#000",border:"1px solid #1a1a1a",padding:"7px 10px",color:"#ccc",fontSize:12}}>
            {allowedCats.map(c=><option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
        </FRow>
        <FRow label="Body (paste a GIF url on its own line to embed)">
          <textarea value={body} onChange={e=>setBody(e.target.value)} rows={14}
            placeholder={"Write your post...\n\n# Heading\n```code```\n- list\n**bold**"}
            style={{width:"100%",background:"#000",border:"1px solid #1a1a1a",padding:"0.7rem 0.8rem",color:"#ccc",fontSize:12,lineHeight:1.7}}/>
        </FRow>
        <FRow label="Tags">
          <div style={{background:"#000",border:"1px solid #1a1a1a",padding:"5px 7px",display:"flex",flexWrap:"wrap",gap:4,minHeight:34,alignItems:"center",marginBottom:6}}>
            {tags.map(t=>(
              <span key={t} style={{fontSize:10,padding:"2px 7px",background:"#0f2d1a",color:"#22c55e",border:"1px solid #166534",display:"flex",alignItems:"center",gap:4}}>
                #{t}<button onClick={()=>rmTag(t)} style={{background:"none",border:"none",color:"#22c55e",fontSize:11,lineHeight:1,padding:0}}>x</button>
              </span>
            ))}
            <input value={tagInput} onChange={onTK} placeholder={tags.length===0?"add tags (space to confirm)":""}
              style={{background:"none",border:"none",color:"#ccc",fontSize:11,minWidth:60,flex:1}}/>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
            {ALL_TAGS.filter(t=>!tags.includes(t)).map(t=><TagChip key={t} t={t} onClick={()=>addTag(t)}/>)}
          </div>
        </FRow>
        {err&&<div style={{fontSize:11,color:"#f87171",background:"#111",border:"1px solid #7f1d1d",padding:"6px 10px"}}>{err}</div>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:10,color:"#333"}}>+{POINTS.post_thread} pts for posting</span>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onBack} style={{background:"none",border:"1px solid #1a1a1a",padding:"6px 14px",fontSize:11,color:"#555"}}>Cancel</button>
            <button onClick={submit} disabled={!title.trim()||!body.trim()||busy}
              style={{background:title.trim()&&body.trim()?"#22c55e":"#111",color:title.trim()&&body.trim()?"#000":"#333",border:"none",padding:"6px 18px",fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>
              {busy?"...":"Post Thread"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PUBLIC PROFILE VIEW ────────────────────────────────────
function PublicProfileView({ userId, currentProfile, onOpenThread, onBack }) {
  const [user, setUser]       = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    Promise.all([
      sb.from("profiles").select("*").eq("id",userId).single(),
      sb.from("threads").select("id,title,tags,created_at,views,pinned,locked,categories(slug,label),profiles(username,role),replies(count)")
        .eq("author_id",userId).order("created_at",{ascending:false}).limit(20),
    ]).then(([{data:u},{data:t}])=>{ setUser(u); setThreads(t||[]); setLoading(false); });
  },[userId]);

  if (loading) return <Spinner/>;
  if (!user)   return <div style={{color:"#555",fontSize:12,padding:"2rem"}}>User not found.</div>;

  const roleColor = ROLES[user.role]?.color||"#555";

  return (
    <div className="fi" style={{maxWidth:760}}>
      <button onClick={onBack} style={{background:"none",border:"none",fontSize:11,color:"#555",marginBottom:"1rem",fontFamily:"monospace"}}>← back</button>
      <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a",padding:"1.6rem",marginBottom:"1.5rem"}}>
        <div style={{display:"flex",gap:"1.2rem",alignItems:"flex-start",flexWrap:"wrap"}}>
          <Avi profile={user} size={72}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"1.3rem",color:roleColor,fontWeight:700,marginBottom:2}}>{user.username}</div>
            <div style={{fontSize:10,color:roleColor,marginBottom:"0.8rem"}}>[{ROLES[user.role]?.label||"MEMBER"}]</div>
            {user.bio&&<div style={{fontSize:12,color:"#555",lineHeight:1.7,maxWidth:440,marginBottom:"0.8rem"}}>{user.bio}</div>}
            <div style={{display:"flex",gap:"1.5rem",flexWrap:"wrap"}}>
              {[
                ["Points", <span style={{color:"#f59e0b"}}>⬡ {user.points||0}</span>],
                ["Posts",  user.post_count||0],
                ["Joined", new Date(user.created_at).toLocaleDateString("en-US",{month:"short",year:"numeric"})],
              ].map(([l,v])=>(
                <div key={l}>
                  <div style={{fontSize:"1rem",color:"#22c55e",fontWeight:700}}>{v}</div>
                  <div style={{fontSize:10,color:"#333",textTransform:"uppercase",letterSpacing:"0.08em",marginTop:1}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <SLabel>Threads by {user.username}</SLabel>
      <div style={{marginTop:8}}>
        {threads.filter(t=>canViewCat(t.categories?.slug,currentProfile?.role)).length===0
          ?<div style={{fontSize:11,color:"#333",padding:"2rem",textAlign:"center"}}>no threads yet</div>
          :<div style={{border:"1px solid #1a1a1a"}}>
            {threads.filter(t=>canViewCat(t.categories?.slug,currentProfile?.role)).map((t,i,arr)=>(
              <ThreadRow key={t.id} t={t} onClick={()=>onOpenThread(t)} last={i===arr.length-1}/>
            ))}
          </div>
        }
      </div>
    </div>
  );
}

// ── MARKETPLACE ────────────────────────────────────────────
function MarketView({ profile, onOpenThread, onPointsChanged }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [myThreads, setMyThreads] = useState([]);
  const [showSell, setShowSell]   = useState(false);
  const [selThread, setSelThread] = useState("");
  const [price, setPrice]         = useState("");
  const [busy, setBusy]           = useState(false);
  const [err, setErr]             = useState("");

  const load = useCallback(async()=>{
    setLoading(true);
    const { data } = await sb.from("thread_sales")
      .select("*,threads(id,title,tags,views,created_at,categories(slug,label),profiles(username,role),replies(count)),profiles!thread_sales_seller_id_fkey(username,role,points)")
      .eq("sold",false).order("created_at",{ascending:false});
    setListings(data||[]);
    // load user's own threads that aren't already listed
    const { data: mine } = await sb.from("threads").select("id,title").eq("author_id",profile.id);
    const listed = (data||[]).filter(l=>l.seller_id===profile.id).map(l=>l.thread_id);
    setMyThreads((mine||[]).filter(t=>!listed.includes(t.id)));
    setLoading(false);
  },[profile.id]);

  useEffect(()=>{load();},[load]);

  const listThread = async () => {
    const p = parseInt(price);
    if (!selThread||!p||p<1) { setErr("Pick a thread and set a price > 0."); return; }
    setBusy(true); setErr("");
    await sb.from("thread_sales").insert({ thread_id: selThread, seller_id: profile.id, price: p });
    setShowSell(false); setSelThread(""); setPrice(""); await load();
    setBusy(false);
  };

  const buyThread = async (listing) => {
    if (listing.seller_id === profile.id) { alert("You can't buy your own thread."); return; }
    if ((profile.points||0) < listing.price) { alert(`Not enough points. You need ${listing.price}, you have ${profile.points||0}.`); return; }
    if (!window.confirm(`Buy "${listing.threads?.title}" for ${listing.price} pts?`)) return;
    setBusy(true);
    // deduct from buyer
    await sb.from("profiles").update({ points: (profile.points||0) - listing.price }).eq("id",profile.id);
    // add to seller
    const { data: seller } = await sb.from("profiles").select("points").eq("id",listing.seller_id).single();
    await sb.from("profiles").update({ points: (seller?.points||0) + listing.price }).eq("id",listing.seller_id);
    // transfer thread ownership
    await sb.from("threads").update({ author_id: profile.id }).eq("id",listing.thread_id);
    // mark sold
    await sb.from("thread_sales").update({ sold: true, buyer_id: profile.id }).eq("id",listing.id);
    await load(); onPointsChanged?.(); setBusy(false);
    alert("Thread purchased! It now appears under your profile.");
  };

  return (
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.2rem",flexWrap:"wrap",gap:8}}>
        <div>
          <h2 style={{fontSize:"1rem",color:"#fff",fontWeight:700}}>Thread Market</h2>
          <div style={{fontSize:11,color:"#333",marginTop:2}}>Buy and sell threads using activity points</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:11,color:"#f59e0b"}}>⬡ {profile?.points||0} pts</span>
          <button onClick={()=>setShowSell(!showSell)} style={{background:"#22c55e",color:"#000",border:"none",padding:"5px 14px",fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>
            {showSell?"Cancel":"Sell a Thread"}
          </button>
        </div>
      </div>

      {showSell&&(
        <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a",padding:"1.2rem",marginBottom:"1rem"}} className="fi">
          <div style={{fontSize:11,color:"#555",marginBottom:"0.8rem",letterSpacing:"0.1em",textTransform:"uppercase"}}>List a thread for sale</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
            <div style={{flex:1,minWidth:180}}>
              <div style={{fontSize:10,color:"#555",marginBottom:4}}>Thread</div>
              <select value={selThread} onChange={e=>setSelThread(e.target.value)}
                style={{width:"100%",background:"#000",border:"1px solid #1a1a1a",padding:"6px 8px",color:"#ccc",fontSize:11}}>
                <option value="">Select a thread...</option>
                {myThreads.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div style={{width:100}}>
              <div style={{fontSize:10,color:"#555",marginBottom:4}}>Price (pts)</div>
              <input value={price} onChange={e=>setPrice(e.target.value)} type="number" min="1" placeholder="50"
                style={{width:"100%",background:"#000",border:"1px solid #1a1a1a",padding:"6px 8px",color:"#fff",fontSize:11}}/>
            </div>
            <button onClick={listThread} disabled={busy}
              style={{background:"#22c55e",color:"#000",border:"none",padding:"7px 16px",fontSize:11,fontWeight:700}}>
              {busy?"...":"List"}
            </button>
          </div>
          {err&&<div style={{fontSize:11,color:"#f87171",marginTop:6}}>{err}</div>}
          <div style={{fontSize:10,color:"#333",marginTop:6}}>Selling transfers thread ownership to the buyer.</div>
        </div>
      )}

      {loading?<Spinner/>:listings.length===0?(
        <div style={{padding:"3rem",textAlign:"center",fontSize:11,color:"#333"}}>No threads for sale right now.</div>
      ):(
        <div style={{border:"1px solid #1a1a1a"}}>
          {listings.map((l,i)=>(
            <div key={l.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"1rem",alignItems:"center",padding:"0.9rem 1rem",background:i%2===0?"#0a0a0a":"#000",borderBottom:i===listings.length-1?"none":"1px solid #1a1a1a"}}>
              <div>
                <div style={{fontSize:13,color:"#ddd",fontWeight:600,marginBottom:3}}>{l.threads?.title}</div>
                <div style={{fontSize:11,color:"#333",display:"flex",gap:8,flexWrap:"wrap"}}>
                  <span>{l.threads?.categories?.label}</span>
                  <span style={{color:ROLES[l.profiles?.role]?.color||"#555"}}>by {l.profiles?.username}</span>
                  <span>{fmt(l.threads?.views||0)} views</span>
                  <span>{l.threads?.replies?.[0]?.count||0} replies</span>
                </div>
                <div style={{display:"flex",gap:3,marginTop:4,flexWrap:"wrap"}}>
                  {(l.threads?.tags||[]).slice(0,4).map(t=><TagChip key={t} t={t}/>)}
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:"1rem",color:"#f59e0b",fontWeight:700,marginBottom:6}}>⬡ {l.price}</div>
                {l.seller_id===profile.id?(
                  <span style={{fontSize:10,color:"#333"}}>your listing</span>
                ):(
                  <button onClick={()=>buyThread(l)} disabled={busy}
                    style={{background:(profile.points||0)>=l.price?"#22c55e":"#111",color:(profile.points||0)>=l.price?"#000":"#333",border:"none",padding:"4px 12px",fontSize:10,fontWeight:700}}>
                    {busy?"...":"Buy"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{marginTop:"1.5rem",background:"#0a0a0a",border:"1px solid #1a1a1a",padding:"1rem"}}>
        <SLabel>How points work</SLabel>
        <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:4}}>
          {[
            [`+${POINTS.daily_login} pts`, "Daily login"],
            [`+${POINTS.post_thread} pts`, "Posting a thread"],
            [`+${POINTS.post_reply} pts`,  "Posting a reply"],
            [`+${POINTS.receive_react} pt`,"Someone reacts to your post"],
          ].map(([pts,label])=>(
            <div key={label} style={{display:"flex",gap:8,fontSize:11}}>
              <span style={{color:"#f59e0b",minWidth:60}}>{pts}</span>
              <span style={{color:"#444"}}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ADMIN PANEL ────────────────────────────────────────────
function AdminView({ profile }) {
  const [tab,setTab]         = useState("threads");
  const [threads,setThreads] = useState([]);
  const [users,setUsers]     = useState([]);
  const [reports,setReports] = useState([]);
  const [loading,setLoading] = useState(true);

  const load = useCallback(async()=>{
    setLoading(true);
    const [{data:t},{data:u},{data:r}] = await Promise.all([
      sb.from("threads").select("id,title,pinned,locked,created_at,views,profiles(username,role),categories(label)").order("created_at",{ascending:false}).limit(80),
      sb.from("profiles").select("*").order("created_at",{ascending:false}),
      sb.from("reports").select("*,profiles!reports_reporter_id_fkey(username)").eq("resolved",false).order("created_at",{ascending:false}),
    ]);
    setThreads(t||[]); setUsers(u||[]); setReports(r||[]); setLoading(false);
  },[]);
  useEffect(()=>{load();},[]);

  const setRole  = async(uid,role)=>{ await sb.from("profiles").update({role}).eq("id",uid); setUsers(users.map(u=>u.id===uid?{...u,role}:u)); };
  const banUser  = async(uid,banned)=>{ await sb.from("profiles").update({banned}).eq("id",uid); setUsers(users.map(u=>u.id===uid?{...u,banned}:u)); };
  const pin      = async(id,v)=>{ await sb.from("threads").update({pinned:v}).eq("id",id); setThreads(threads.map(t=>t.id===id?{...t,pinned:v}:t)); };
  const lock     = async(id,v)=>{ await sb.from("threads").update({locked:v}).eq("id",id); setThreads(threads.map(t=>t.id===id?{...t,locked:v}:t)); };
  const del      = async id=>{ if(!window.confirm("Delete?")) return; await sb.from("threads").delete().eq("id",id); setThreads(threads.filter(t=>t.id!==id)); };
  const resolve  = async id=>{ await sb.from("reports").update({resolved:true}).eq("id",id); setReports(reports.filter(r=>r.id!==id)); };

  const allRoles = Object.entries(ROLES).map(([k,v])=>({value:k,label:v.label}));
  const tabs = [["threads","Threads"],["users","Members"],["reports",`Reports${reports.length>0?` (${reports.length})`:""}`]];

  return (
    <div className="fi">
      <h2 style={{fontSize:"1rem",color:"#fff",fontWeight:700,marginBottom:"1.2rem"}}>Mod Panel</h2>
      <div style={{display:"flex",gap:2,borderBottom:"1px solid #1a1a1a",marginBottom:"1rem"}}>
        {tabs.map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{background:"none",border:"none",borderBottom:`2px solid ${tab===id?"#22c55e":"transparent"}`,padding:"6px 14px",fontSize:11,color:tab===id?"#fff":reports.length>0&&id==="reports"?"#f87171":"#555",fontFamily:"monospace",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:-1}}>
            {label}
          </button>
        ))}
      </div>
      {loading?<Spinner/>:(
        <>
          {tab==="threads"&&(
            <div style={{border:"1px solid #1a1a1a"}}>
              {threads.map((t,i)=>(
                <div key={t.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"0.8rem",alignItems:"center",padding:"0.7rem 1rem",background:i%2===0?"#0a0a0a":"#000",borderBottom:i===threads.length-1?"none":"1px solid #1a1a1a"}}>
                  <div>
                    <div style={{fontSize:12,color:"#ddd",marginBottom:2}}>{t.title}</div>
                    <div style={{fontSize:10,color:"#333",display:"flex",gap:8}}>
                      <span>{t.categories?.label}</span>
                      <span style={{color:ROLES[t.profiles?.role]?.color||"#555"}}>{t.profiles?.username}</span>
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                      <span>{fmt(t.views||0)} views</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4}}>
                    <MBtn label={t.pinned?"Unpin":"Pin"}   onClick={()=>pin(t.id,!t.pinned)}/>
                    <MBtn label={t.locked?"Unlock":"Lock"} onClick={()=>lock(t.id,!t.locked)}/>
                    <MBtn label="Delete" onClick={()=>del(t.id)} red/>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab==="users"&&(
            <div style={{border:"1px solid #1a1a1a"}}>
              {users.map((u,i)=>(
                <div key={u.id} style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:"0.8rem",alignItems:"center",padding:"0.75rem 1rem",background:u.banned?"#110000":i%2===0?"#0a0a0a":"#000",borderBottom:i===users.length-1?"none":"1px solid #1a1a1a"}}>
                  <Avi profile={u}/>
                  <div>
                    <div style={{fontSize:12,color:u.banned?"#ef4444":ROLES[u.role]?.color||"#555",fontWeight:700}}>
                      {u.username}{u.banned&&<span style={{fontSize:9,color:"#ef4444",marginLeft:6}}>[BANNED]</span>}
                    </div>
                    <div style={{fontSize:10,color:"#333",marginTop:2,display:"flex",gap:8}}>
                      <span>{u.post_count||0} posts</span>
                      <span style={{color:"#f59e0b"}}>⬡ {u.points||0}</span>
                      <span>joined {new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                    {u.bio&&<div style={{fontSize:10,color:"#444",marginTop:1}}>{u.bio}</div>}
                  </div>
                  <div style={{display:"flex",gap:4,alignItems:"center"}}>
                    {profile.role==="admin"&&u.id!==profile.id&&(
                      <select value={u.role} onChange={e=>setRole(u.id,e.target.value)}
                        style={{background:"#000",border:"1px solid #1a1a1a",padding:"4px 8px",color:ROLES[u.role]?.color||"#555",fontSize:10}}>
                        {allRoles.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    )}
                    {u.id!==profile.id&&<MBtn label={u.banned?"Unban":"Ban"} onClick={()=>banUser(u.id,!u.banned)} red={!u.banned}/>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab==="reports"&&(
            <div style={{border:"1px solid #1a1a1a"}}>
              {reports.length===0?(
                <div style={{padding:"2rem",textAlign:"center",fontSize:11,color:"#333"}}>No open reports.</div>
              ):reports.map((r,i)=>(
                <div key={r.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"0.8rem",alignItems:"center",padding:"0.7rem 1rem",background:i%2===0?"#0a0a0a":"#000",borderBottom:i===reports.length-1?"none":"1px solid #1a1a1a"}}>
                  <div>
                    <div style={{fontSize:11,color:"#ddd",marginBottom:2}}>
                      <span style={{color:"#f59e0b"}}>{r.target_type}</span> reported by <span style={{color:"#22c55e"}}>{r.profiles?.username}</span>
                    </div>
                    <div style={{fontSize:10,color:"#333"}}>{r.reason} · {timeAgo(r.created_at)}</div>
                    <div style={{fontSize:9,color:"#222",marginTop:1}}>ID: {r.target_id}</div>
                  </div>
                  <MBtn label="Resolve" onClick={()=>resolve(r.id)}/>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── PROFILE (own) ──────────────────────────────────────────
function ProfileView({ profile, onOpenThread, onProfileUpdate, onOpenProfile }) {
  const [threads,setThreads]     = useState([]);
  const [editing,setEditing]     = useState(false);
  const [bio,setBio]             = useState(profile.bio||"");
  const [avatarUrl,setAvatarUrl] = useState(profile.avatar_url||"");
  const [uploading,setUploading] = useState(false);
  const [saving,setSaving]       = useState(false);
  const [pointsLog,setPointsLog] = useState([]);
  const fileRef = useRef();

  useEffect(()=>{
    sb.from("threads").select("id,title,tags,created_at,views,pinned,locked,categories(slug,label),profiles(username,role),replies(count)")
      .eq("author_id",profile.id).order("created_at",{ascending:false})
      .then(({data})=>setThreads(data||[]));
    sb.from("points_log").select("*").eq("user_id",profile.id).order("created_at",{ascending:false}).limit(10)
      .then(({data})=>setPointsLog(data||[]));
  },[profile.id]);

  const uploadAvatar = async e=>{
    const file = e.target.files[0];
    if(!file) return;
    if(file.size>2*1024*1024){ alert("Max 2MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${profile.id}/avatar.${ext}`;
    const {error:upErr} = await sb.storage.from("avatars").upload(path,file,{upsert:true});
    if(upErr){ alert("Upload failed: "+upErr.message); setUploading(false); return; }
    const {data:{publicUrl}} = sb.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(publicUrl+"?t="+Date.now()); setUploading(false);
  };

  const saveProfile = async()=>{
    setSaving(true);
    await sb.from("profiles").update({bio:bio.trim().slice(0,150),avatar_url:avatarUrl}).eq("id",profile.id);
    setSaving(false); setEditing(false); onProfileUpdate();
  };

  return (
    <div className="fi">
      <div style={{display:"flex",gap:8,marginBottom:"1rem",alignItems:"center"}}>
        <h2 style={{fontSize:"1rem",color:"#fff",fontWeight:700,flex:1}}>My Profile</h2>
        <button onClick={()=>onOpenProfile(profile.id)} style={{background:"none",border:"1px solid #1a1a1a",padding:"4px 10px",fontSize:10,color:"#555",fontFamily:"monospace"}}>
          view public page
        </button>
      </div>
      <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a",padding:"1.4rem",marginBottom:"1.5rem"}}>
        <div style={{display:"flex",gap:"1rem",alignItems:"flex-start",flexWrap:"wrap"}}>
          <div style={{position:"relative"}}>
            <Avi profile={{...profile,avatar_url:avatarUrl}} size={64}/>
            {editing&&(
              <>
                <button onClick={()=>fileRef.current.click()} style={{position:"absolute",bottom:-6,right:-6,background:"#22c55e",color:"#000",border:"none",borderRadius:2,fontSize:9,padding:"2px 5px",fontFamily:"monospace",fontWeight:700,cursor:"pointer"}}>
                  {uploading?"...":"edit"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={uploadAvatar} style={{display:"none"}}/>
              </>
            )}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"1.1rem",color:ROLES[profile.role]?.color||"#fff",fontWeight:700}}>{profile.username}</div>
            <div style={{fontSize:10,color:ROLES[profile.role]?.color||"#555",marginTop:2,marginBottom:8}}>[{ROLES[profile.role]?.label}]</div>
            {editing?(
              <div>
                <textarea value={bio} onChange={e=>setBio(e.target.value.slice(0,150))} rows={3} placeholder="Write a short bio..."
                  style={{width:"100%",maxWidth:400,background:"#000",border:"1px solid #1a1a1a",padding:"6px 8px",color:"#ccc",fontSize:12,lineHeight:1.6}}/>
                <div style={{fontSize:9,color:"#333",textAlign:"right",maxWidth:400}}>{bio.length}/150</div>
              </div>
            ):(
              <div style={{fontSize:12,color:"#555",lineHeight:1.6}}>{profile.bio||<span style={{color:"#333"}}>no bio set</span>}</div>
            )}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
            <div style={{display:"flex",gap:"1.5rem"}}>
              {[
                ["Points", <span style={{color:"#f59e0b"}}>⬡ {profile.points||0}</span>],
                ["Posts",  profile.post_count||0],
                ["Since",  new Date(profile.created_at).getFullYear()],
              ].map(([l,v])=>(
                <div key={l} style={{textAlign:"right"}}>
                  <div style={{fontSize:"1rem",color:"#22c55e",fontWeight:700}}>{v}</div>
                  <div style={{fontSize:10,color:"#333",textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</div>
                </div>
              ))}
            </div>
            {editing?(
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>{setEditing(false);setBio(profile.bio||"");setAvatarUrl(profile.avatar_url||"");}}
                  style={{background:"none",border:"1px solid #1a1a1a",padding:"4px 10px",fontSize:10,color:"#555",fontFamily:"monospace"}}>cancel</button>
                <button onClick={saveProfile} disabled={saving}
                  style={{background:"#22c55e",border:"none",padding:"4px 12px",fontSize:10,color:"#000",fontFamily:"monospace",fontWeight:700}}>
                  {saving?"...":"save"}
                </button>
              </div>
            ):(
              <button onClick={()=>setEditing(true)} style={{background:"none",border:"1px solid #1a1a1a",padding:"4px 10px",fontSize:10,color:"#555",fontFamily:"monospace"}}>edit profile</button>
            )}
          </div>
        </div>
      </div>

      {pointsLog.length>0&&(
        <div style={{marginBottom:"1.5rem"}}>
          <SLabel>Recent Points Activity</SLabel>
          <div style={{marginTop:8,border:"1px solid #1a1a1a"}}>
            {pointsLog.map((l,i)=>(
              <div key={l.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 10px",background:i%2===0?"#0a0a0a":"#000",borderBottom:i===pointsLog.length-1?"none":"1px solid #1a1a1a",fontSize:11}}>
                <span style={{color:"#444"}}>{l.reason}</span>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <span style={{color:"#f59e0b"}}>+{l.amount}</span>
                  <span style={{color:"#222",fontSize:10}}>{timeAgo(l.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <SLabel>My Threads</SLabel>
      <div style={{marginTop:8}}>
        {threads.length===0
          ?<div style={{fontSize:11,color:"#333",padding:"2rem",textAlign:"center"}}>no threads yet</div>
          :<div style={{border:"1px solid #1a1a1a"}}>{threads.map((t,i)=><ThreadRow key={t.id} t={t} onClick={()=>onOpenThread(t)} last={i===threads.length-1}/>)}</div>
        }
      </div>
    </div>
  );
}

// ── SHARED ─────────────────────────────────────────────────
function Avi({profile,size=28}) {
  const c=ROLES[profile?.role]?.color||"#333";
  const l=(profile?.username||"?")[0].toUpperCase();
  if(profile?.avatar_url) return <img src={profile.avatar_url} style={{width:size,height:size,borderRadius:2,objectFit:"cover",border:`1px solid ${c}33`,flexShrink:0}} onError={e=>{e.target.style.display="none";}}/>;
  return <div style={{width:size,height:size,borderRadius:2,background:"#0a0a0a",border:`1px solid ${c}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.42,color:c,fontWeight:700,flexShrink:0,fontFamily:"monospace"}}>{l}</div>;
}
function Pill({label,green,dim}) {
  const c=green?"#22c55e":dim?"#555":"#444";
  return <span style={{fontSize:9,padding:"1px 5px",background:`${c}14`,color:c,border:`1px solid ${c}33`,fontFamily:"monospace",letterSpacing:"0.08em"}}>{label}</span>;
}
function TagChip({t,active,onClick}) {
  return <span onClick={onClick} style={{fontSize:10,padding:"1px 6px",background:active?"#0f2d1a":"#0a0a0a",color:active?"#22c55e":"#444",border:`1px solid ${active?"#166534":"#1a1a1a"}`,cursor:onClick?"pointer":"default",userSelect:"none",transition:"all 0.1s"}}>#{t}</span>;
}
function MBtn({label,onClick,red}) {
  const c=red?"#ef4444":"#555";
  return <button onClick={onClick} style={{background:"none",border:`1px solid ${c}33`,padding:"2px 8px",fontSize:10,color:c,letterSpacing:"0.05em"}}>{label}</button>;
}
function SLabel({children}) {
  return <div style={{fontSize:10,color:"#333",letterSpacing:"0.15em",textTransform:"uppercase",fontFamily:"monospace"}}>{children}</div>;
}
function FRow({label,children}) {
  return <div><div style={{fontSize:10,color:"#555",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:5}}>{label}</div>{children}</div>;
}
function LabeledInput({label,value,onChange,placeholder,type="text"}) {
  return <div>
    <div style={{fontSize:10,color:"#555",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>{label}</div>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:"100%",background:"#000",border:"1px solid #1a1a1a",padding:"7px 10px",color:"#fff",fontSize:12}}/>
  </div>;
}
function Spinner() {
  return <div style={{display:"flex",justifyContent:"center",padding:"3rem"}}>
    <div style={{width:24,height:24,border:"2px solid #1a1a1a",borderTop:"2px solid #22c55e",borderRadius:"50%"}} className="spin"/>
  </div>;
}
function Splash() {
  return <div style={{minHeight:"100vh",background:"#000",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{width:24,height:24,border:"2px solid #1a1a1a",borderTop:"2px solid #22c55e",borderRadius:"50%"}} className="spin"/>
  </div>;
}
