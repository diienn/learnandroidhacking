import { useState } from "react";

const ROLES = {
  admin:     { label: "ADMIN",  color: "#ffffff" },
  moderator: { label: "MOD",    color: "#22c55e" },
  member:    { label: "MEMBER", color: "#555555" },
};

const REACTIONS = ["+1","lol","fire","wtf","love"];

const CATEGORIES = [
  { slug: "all",           label: "All" },
  { slug: "announcements", label: "Announcements" },
  { slug: "guides",        label: "Guides" },
  { slug: "youtube",       label: "YouTube" },
  { slug: "showcase",      label: "Showcases" },
  { slug: "mods",          label: "Mods" },
  { slug: "templates",     label: "Templates" },
  { slug: "help",          label: "Help" },
  { slug: "offtopic",      label: "Off-Topic" },
];

const MOCK_USERS = {
  1: { id:1, username:"Geek",     role:"admin",     post_count:142 },
  2: { id:2, username:"NullPtr",  role:"moderator", post_count:88  },
  3: { id:3, username:"hexwitch", role:"member",    post_count:21  },
  4: { id:4, username:"dobbydev", role:"member",    post_count:9   },
};

const MOCK_THREADS = [
  {
    id:1, authorId:1, category:"guides", title:"BNM Complete Setup Guide for Unity 2022.3",
    body:`# BNM Setup Guide\n\nThis guide walks you through setting up ByNameModding for Unity 2022.3 IL2CPP games on Android.\n\n## Prerequisites\n- Android NDK r25\n- CMake 3.22.1\n- Android Studio Hedgehog+\n\n## Step 1: Add BNM to your project\n\nClone BNM into your jni/libs folder:\n\n\`\`\`cmake\nadd_subdirectory(libs/BNM)\ntarget_link_libraries(mod BNM)\n\`\`\`\n\n## Step 2: Initialize in JNI_OnLoad\n\n\`\`\`cpp\nBNM::Loading::TryLoadByJNI(env);\n\`\`\``,
    tags:["bnm","il2cpp","unity","guide"], pinned:true, locked:false,
    views:312, created:"2024-03-01T10:00:00Z",
    replies:[
      { id:1, authorId:2, body:"Great guide. One thing to add: make sure your BNM version matches the Unity IL2CPP version. Mismatches cause silent failures.", created:"2024-03-01T11:20:00Z", reactions:{ "+1":3, "fire":1 } },
      { id:2, authorId:3, body:"This helped me finally get my first hook working. Thanks!", created:"2024-03-02T09:15:00Z", reactions:{ "+1":2 } },
    ]
  },
  {
    id:2, authorId:2, category:"help", title:"Dobby inline hook crashing on xrEndFrame — SIGSEGV at trampoline",
    body:`Hey, trying to hook xrEndFrame in libopenxr_loader.so using Dobby but getting a crash on the second call.\n\n\`\`\`cpp\nDobbyHook((void*)xrEndFrame_addr, (void*)my_hook, (void**)&orig_xrEndFrame);\n\`\`\`\n\nLogcat shows SIGSEGV at the trampoline. Any ideas?`,
    tags:["dobby","openxr","crash","help"], pinned:false, locked:false,
    views:87, created:"2024-03-15T14:30:00Z",
    replies:[
      { id:1, authorId:1, body:"Classic trampoline issue — are you hooking before the library is fully loaded? Add a dlopen check first. Also make sure Dobby is arm64-v8a not armeabi-v7a.", created:"2024-03-15T15:00:00Z", reactions:{ "+1":5 } },
    ]
  },
  {
    id:3, authorId:1, category:"templates", title:"[TEMPLATE] OpenXR API Layer Skeleton — XrCompositionLayerQuad",
    body:`Releasing my OpenXR API layer template. This hooks xrEndFrame and injects a 2D quad overlay into any Quest game.\n\n**Files included:**\n- layer.cpp — main intercept logic\n- CMakeLists.txt — build config\n- Two SPIR-V shaders (vert/frag)\n\nMIT licensed. Download below.`,
    tags:["openxr","template","quest","vr","vulkan"], pinned:true, locked:false,
    views:198, created:"2024-03-20T09:00:00Z",
    replies:[
      { id:1, authorId:4, body:"Works on Quest 3 with minor tweaks to the swapchain format. Solid starting point.", created:"2024-03-21T08:00:00Z", reactions:{ "+1":7, "fire":3 } },
      { id:2, authorId:3, body:"Can you add XrActionSet input handling to the template?", created:"2024-03-22T10:00:00Z", reactions:{} },
      { id:3, authorId:2, body:"Input handling will be in v2.", created:"2024-03-22T11:30:00Z", reactions:{ "+1":2 } },
    ]
  },
  {
    id:4, authorId:3, category:"help", title:"How do I read a float field with BNM at runtime?",
    body:`I dumped the game and found health : System.Single on the PlayerHealth class. I can get the class fine but not sure how to read the field value at runtime. Using latest BNM from GitHub.`,
    tags:["bnm","fields","help","beginner"], pinned:false, locked:false,
    views:54, created:"2024-03-25T16:00:00Z",
    replies:[
      { id:1, authorId:1, body:`Use BNM::Field<float>:\n\n\`\`\`cpp\nBNM::Field<float> healthField;\nhealthField.Init(playerHealthClass["health"]);\nfloat val = healthField[instance];\n\`\`\`\n\nMake sure you call Init after BNM is loaded.`, created:"2024-03-25T16:45:00Z", reactions:{ "+1":4 } },
    ]
  },
  {
    id:5, authorId:4, category:"help", title:"NDK build broken after Android Studio update — CMake toolchain error",
    body:`After updating Android Studio to Iguana my build fails with:\n\`CMake Error: incompatible toolchain\`\n\nWas working on Hedgehog. NDK r25c, CMake 3.22.1.`,
    tags:["ndk","cmake","build","help"], pinned:false, locked:false,
    views:43, created:"2024-04-01T11:00:00Z",
    replies:[
      { id:1, authorId:2, body:"Lock AGP to 8.3.2 in your project build.gradle. Also set Gradle wrapper to 8.5. Known issue with AGP 8.4+.", created:"2024-04-01T11:30:00Z", reactions:{ "+1":6 } },
    ]
  },
  {
    id:6, authorId:1, category:"announcements", title:"Welcome to LearnAndroidHacking — read before posting",
    body:`Welcome. A few rules:\n\n- Be respectful\n- No asking for prebuilt mods — we teach, you build\n- Tag your threads properly\n- Search before posting\n\nEnjoy.`,
    tags:["meta"], pinned:true, locked:true,
    views:521, created:"2024-01-01T00:00:00Z",
    replies:[]
  },
];

const timeAgo = (iso) => {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};
const fmt = n => n >= 1000 ? (n/1000).toFixed(1)+"k" : n;
const canMod = role => role === "admin" || role === "moderator";

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
    if (!trimmed) { out.push(<div key={i} style={{height:"0.4rem"}}/>); return; }
    if (line.startsWith("# "))       out.push(<h2 key={i} style={{fontSize:"1.1rem",color:"#fff",margin:"0.8rem 0 0.3rem",fontWeight:700}}>{line.slice(2)}</h2>);
    else if (line.startsWith("## ")) out.push(<h3 key={i} style={{fontSize:"0.95rem",color:"#ccc",margin:"0.5rem 0 0.2rem",fontWeight:600}}>{line.slice(3)}</h3>);
    else if (line.startsWith("- "))  out.push(<div key={i} style={{color:"#777",paddingLeft:"1rem",marginBottom:2,fontSize:13}}>- {line.slice(2)}</div>);
    else {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      out.push(<p key={i} style={{color:"#888",marginBottom:2,lineHeight:1.75,fontSize:13}}>{parts.map((p,j)=>p.startsWith("**")&&p.endsWith("**")?<strong key={j} style={{color:"#ccc",fontWeight:600}}>{p.slice(2,-2)}</strong>:p)}</p>);
    }
  });
  return out;
}

// ── MOCK CURRENT USER (toggle to test roles) ──
const CURRENT_USER = MOCK_USERS[1]; // admin

export default function App() {
  const [view, setView]         = useState("home"); // home | login | forum | thread | new | admin | profile
  const [activeCat, setActiveCat] = useState("all");
  const [activeTag, setActiveTag] = useState(null);
  const [search, setSearch]     = useState("");
  const [thread, setThread]     = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactions, setReactions] = useState({});// key: "thread-1-+1" => count

  const openThread = t => { setThread(t); setView("thread"); };
  const goHome = () => { setView("home"); setActiveTag(null); setSearch(""); setMenuOpen(false); };

  const getReactionCount = (type, id, emoji) => {
    const key = `${type}-${id}-${emoji}`;
    return reactions[key] || 0;
  };
  const toggleReaction = (type, id, emoji) => {
    const key = `${type}-${id}-${emoji}`;
    setReactions(r => ({ ...r, [key]: (r[key] || 0) > 0 ? 0 : 1 }));
  };

  if (view === "login") return <LoginScreen onBack={() => setView("home")} />;

  return (
    <div style={{minHeight:"100vh",background:"#000",color:"#ccc",fontFamily:"monospace"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#000} ::-webkit-scrollbar-thumb{background:#222}
        input,textarea,select{outline:none;font-family:monospace} textarea{resize:vertical}
        @keyframes fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fi{animation:fadein 0.18s ease}
        button{cursor:pointer}
        .row:hover{background:#0a0a0a !important}
        .catbtn:hover{color:#fff !important}
      `}</style>

      {/* NAV */}
      <nav style={{background:"#000",borderBottom:"1px solid #1a1a1a",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1100,margin:"0 auto",padding:"0 1.2rem",height:48,display:"flex",alignItems:"center",gap:"1rem"}}>
          <button onClick={goHome} style={{background:"none",border:"none",fontSize:"0.95rem",fontWeight:700,color:"#fff",letterSpacing:"0.04em",fontFamily:"monospace"}}>LAH</button>
          <span style={{color:"#1a1a1a",fontSize:18}}>|</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>setView("forum")} placeholder="search..."
            style={{flex:1,maxWidth:300,background:"#0a0a0a",border:"1px solid #1a1a1a",padding:"4px 10px",color:"#ccc",fontSize:12}}/>
          <div style={{display:"flex",gap:8,alignItems:"center",marginLeft:"auto"}}>
            <button onClick={()=>setView("forum")} style={{background:"none",border:"none",fontSize:11,color:["forum","thread","new"].includes(view)?"#fff":"#555",fontFamily:"monospace",letterSpacing:"0.08em",textTransform:"uppercase",padding:"4px 0",borderBottom:`1px solid ${["forum","thread","new"].includes(view)?"#22c55e":"transparent"}`}}>Forum</button>
            {canMod(CURRENT_USER.role) && (
              <button onClick={()=>setView("admin")} style={{background:"none",border:"none",fontSize:11,color:view==="admin"?"#fff":"#555",fontFamily:"monospace",letterSpacing:"0.08em",textTransform:"uppercase",padding:"4px 0",borderBottom:`1px solid ${view==="admin"?"#22c55e":"transparent"}`}}>Mod Panel</button>
            )}
            <div style={{position:"relative"}}>
              <button onClick={()=>setMenuOpen(o=>!o)} style={{background:"none",border:"1px solid #1a1a1a",padding:"4px 10px",color:"#ccc",fontSize:11,fontFamily:"monospace",display:"flex",alignItems:"center",gap:7}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:ROLES[CURRENT_USER.role].color,display:"inline-block"}}/>
                {CURRENT_USER.username}
                <span style={{color:ROLES[CURRENT_USER.role].color,fontSize:10}}>[{ROLES[CURRENT_USER.role].label}]</span>
              </button>
              {menuOpen && (
                <div onClick={()=>setMenuOpen(false)} style={{position:"absolute",right:0,top:"calc(100% + 2px)",background:"#0a0a0a",border:"1px solid #1a1a1a",minWidth:130,zIndex:200}}>
                  <button onClick={()=>setView("profile")} style={{display:"block",width:"100%",background:"none",border:"none",padding:"8px 1rem",fontSize:11,color:"#ccc",fontFamily:"monospace",textAlign:"left"}} className="row">Profile</button>
                  <button onClick={()=>setView("login")}  style={{display:"block",width:"100%",background:"none",border:"none",padding:"8px 1rem",fontSize:11,color:"#555",fontFamily:"monospace",textAlign:"left"}} className="row">Sign Out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"1.5rem 1.2rem"}}>
        {view==="home"    && <HomeView    onSelectCat={s=>{setActiveCat(s);setView("forum")}} />}
        {view==="forum"   && <ForumView   activeCat={activeCat} setActiveCat={setActiveCat} activeTag={activeTag} setActiveTag={setActiveTag} search={search} onOpenThread={openThread} onNew={()=>setView("new")} />}
        {view==="thread"  && thread && <ThreadDetailView thread={thread} onBack={()=>setView("forum")} getReact={getReactionCount} toggleReact={toggleReaction} />}
        {view==="new"     && <NewThreadView onBack={()=>setView("forum")} onPost={t=>{openThread(t)}} />}
        {view==="admin"   && <AdminPanelView />}
        {view==="profile" && <ProfileView user={CURRENT_USER} onOpenThread={openThread} />}
      </div>
    </div>
  );
}

// ── LOGIN ──
function LoginScreen({ onBack }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [uname, setUname] = useState("");

  return (
    <div style={{minHeight:"100vh",background:"#000",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace"}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} input{outline:none;font-family:monospace}`}</style>
      <div style={{marginBottom:"2.5rem",textAlign:"center"}}>
        <div style={{fontSize:"1.4rem",fontWeight:700,color:"#fff",letterSpacing:"0.05em",marginBottom:6}}>LearnAndroidHacking</div>
        <div style={{fontSize:11,color:"#333",letterSpacing:"0.15em",textTransform:"uppercase"}}>Free Android Modding Community</div>
      </div>
      <div style={{width:"100%",maxWidth:340,background:"#0a0a0a",border:"1px solid #1a1a1a",padding:"2rem"}}>
        <div style={{display:"flex",borderBottom:"1px solid #1a1a1a",marginBottom:"1.5rem"}}>
          {["login","signup"].map(m=>(
            <button key={m} onClick={()=>setMode(m)}
              style={{flex:1,background:"none",border:"none",borderBottom:`2px solid ${mode===m?"#22c55e":"transparent"}`,padding:"0.5rem",cursor:"pointer",fontSize:12,color:mode===m?"#fff":"#555",fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:-1}}>
              {m==="login"?"Sign In":"Register"}
            </button>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"0.8rem"}}>
          {mode==="signup" && <LInput label="Username" value={uname} onChange={setUname} placeholder="your_handle" />}
          <LInput label="Email"    type="email"    value={email} onChange={setEmail} placeholder="you@example.com" />
          <LInput label="Password" type="password" value={pass}  onChange={setPass}  placeholder="••••••••" />
          <button onClick={onBack} style={{background:"#22c55e",color:"#000",border:"none",padding:"10px",fontSize:12,fontFamily:"monospace",fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",marginTop:4}}>
            {mode==="login"?"Sign In":"Create Account"}
          </button>
        </div>
      </div>
      <div style={{marginTop:"1.5rem",fontSize:11,color:"#222"}}>Free forever. No paywalls.</div>
    </div>
  );
}

// ── HOME ──
function HomeView({ onSelectCat }) {
  const mainCats = CATEGORIES.filter(c=>c.slug!=="all");
  const latest   = MOCK_THREADS.slice(0,5);
  return (
    <div className="fi">
      <div style={{paddingBottom:"2rem",marginBottom:"2rem",borderBottom:"1px solid #1a1a1a"}}>
        <div style={{fontSize:11,color:"#333",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8}}>Free Android Modding Community</div>
        <h1 style={{fontSize:"1.7rem",color:"#fff",fontWeight:700,marginBottom:"0.5rem",letterSpacing:"0.02em"}}>LearnAndroidHacking</h1>
        <p style={{fontSize:13,color:"#555",lineHeight:1.7,maxWidth:460}}>IL2CPP, native hooking, VR modding, reverse engineering. All free. No paywalls.</p>
        <div style={{display:"flex",gap:"2rem",marginTop:"1.2rem",flexWrap:"wrap"}}>
          {[["Threads","24"],["Members","138"],["Posts","412"]].map(([l,v])=>(
            <div key={l}>
              <div style={{fontSize:"1.2rem",color:"#22c55e",fontWeight:700}}>{v}</div>
              <div style={{fontSize:10,color:"#333",textTransform:"uppercase",letterSpacing:"0.1em",marginTop:1}}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{marginBottom:"2rem"}}>
        <SLabel>Categories</SLabel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:"1px",border:"1px solid #1a1a1a",marginTop:10}}>
          {mainCats.map(cat=>(
            <button key={cat.slug} onClick={()=>onSelectCat(cat.slug)}
              style={{background:"#0a0a0a",border:"none",padding:"1.1rem 1rem",textAlign:"left",transition:"background 0.1s"}}
              onMouseEnter={e=>e.currentTarget.style.background="#111"}
              onMouseLeave={e=>e.currentTarget.style.background="#0a0a0a"}>
              <div style={{fontSize:12,color:"#fff",fontWeight:700,marginBottom:4}}>{cat.label}</div>
              <div style={{fontSize:10,color:"#333"}}>{MOCK_THREADS.filter(t=>t.category===cat.slug).length} threads</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SLabel>Latest Posts</SLabel>
        <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:1}}>
          {latest.map(t=>(
            <div key={t.id} style={{background:"#0a0a0a",padding:"0.7rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem",flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:13,color:"#ddd",marginBottom:3}}>{t.title}</div>
                <div style={{fontSize:11,color:"#333",display:"flex",gap:8}}>
                  <span style={{color:ROLES[MOCK_USERS[t.authorId].role].color}}>{MOCK_USERS[t.authorId].username}</span>
                  <span>{t.category}</span>
                  <span>{timeAgo(t.created)}</span>
                </div>
              </div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {t.tags.slice(0,3).map(tg=><TagChip key={tg} t={tg}/>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── FORUM ──
function ForumView({ activeCat, setActiveCat, activeTag, setActiveTag, search, onOpenThread, onNew }) {
  const [sort, setSort] = useState("latest");

  const filtered = MOCK_THREADS.filter(t => {
    if (activeCat !== "all" && t.category !== activeCat) return false;
    if (activeTag && !t.tags.includes(activeTag)) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a,b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return sort==="views" ? b.views-a.views : new Date(b.created)-new Date(a.created);
  });

  const ALL_TAGS = ["bnm","il2cpp","unity","dobby","openxr","quest","vr","vulkan","ndk","cmake","imgui","egl","frida","ghidra","arm64","hook","android","beginner","template","guide","crash","help","build"];

  return (
    <div style={{display:"flex",gap:"1.5rem"}} className="fi">
      <aside style={{width:155,flexShrink:0}}>
        <SLabel>Categories</SLabel>
        <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:1}}>
          {CATEGORIES.map(c=>(
            <button key={c.slug} onClick={()=>{setActiveCat(c.slug);setActiveTag(null)}} className="catbtn"
              style={{background:activeCat===c.slug?"#111":"none",border:"none",padding:"5px 8px",textAlign:"left",fontSize:11,color:activeCat===c.slug?"#fff":"#555",fontFamily:"monospace",letterSpacing:"0.04em",borderLeft:`2px solid ${activeCat===c.slug?"#22c55e":"transparent"}`,transition:"all 0.1s"}}>
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
          <h2 style={{fontSize:"1rem",color:"#fff",fontWeight:700}}>{activeTag?`#${activeTag}`:CATEGORIES.find(c=>c.slug===activeCat)?.label}</h2>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <select value={sort} onChange={e=>setSort(e.target.value)} style={{background:"#0a0a0a",border:"1px solid #1a1a1a",color:"#555",padding:"4px 8px",fontSize:11}}>
              <option value="latest">Latest</option>
              <option value="views">Most Viewed</option>
            </select>
            <button onClick={onNew} style={{background:"#22c55e",color:"#000",border:"none",padding:"5px 14px",fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>New Thread</button>
          </div>
        </div>
        {filtered.length===0
          ? <div style={{padding:"3rem",textAlign:"center",fontSize:11,color:"#333"}}>no threads found</div>
          : <div style={{border:"1px solid #1a1a1a"}}>{filtered.map((t,i)=><TRow key={t.id} t={t} onClick={()=>onOpenThread(t)} last={i===filtered.length-1}/>)}</div>
        }
      </div>
    </div>
  );
}

function TRow({ t, onClick, last }) {
  const author = MOCK_USERS[t.authorId];
  return (
    <div onClick={onClick} className="row"
      style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"0.8rem",alignItems:"center",padding:"0.85rem 1rem",borderBottom:last?"none":"1px solid #1a1a1a",cursor:"pointer",background:"#000",position:"relative",transition:"background 0.1s"}}>
      {t.pinned && <div style={{position:"absolute",left:0,top:0,bottom:0,width:2,background:"#22c55e"}}/>}
      <div style={{minWidth:0,paddingLeft:t.pinned?8:0}}>
        <div style={{display:"flex",gap:5,marginBottom:3,alignItems:"center",flexWrap:"wrap"}}>
          {t.pinned && <Pill label="PINNED" green/>}
          {t.locked && <Pill label="LOCKED" dim/>}
          <Pill label={t.category}/>
        </div>
        <div style={{fontSize:13,color:"#ddd",fontWeight:600,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.title}</div>
        <div style={{display:"flex",alignItems:"center",gap:"0.6rem",flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:ROLES[author.role].color}}>{author.username}</span>
          <span style={{fontSize:11,color:"#222"}}>·</span>
          <span style={{fontSize:11,color:"#333"}}>{timeAgo(t.created)}</span>
          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{t.tags.slice(0,4).map(tg=><TagChip key={tg} t={tg}/>)}</div>
        </div>
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div style={{fontSize:11,color:"#444"}}>{t.replies.length} replies</div>
        <div style={{fontSize:10,color:"#222",marginTop:2}}>{fmt(t.views)} views</div>
      </div>
    </div>
  );
}

// ── THREAD DETAIL ──
function ThreadDetailView({ thread, onBack, getReact, toggleReact }) {
  const [replyBody, setBody] = useState("");
  const [replies, setReplies] = useState(thread.replies);
  const [locked, setLocked]  = useState(thread.locked);
  const [pinned, setPinned]  = useState(thread.pinned);
  const author = MOCK_USERS[thread.authorId];
  const isMod = canMod(CURRENT_USER.role);

  const postReply = () => {
    if (!replyBody.trim() || locked) return;
    setReplies([...replies, { id: Date.now(), authorId: CURRENT_USER.id, body: replyBody.trim(), created: new Date().toISOString(), reactions:{} }]);
    setBody("");
  };

  return (
    <div className="fi">
      <button onClick={onBack} style={{background:"none",border:"none",fontSize:11,color:"#555",fontFamily:"monospace",marginBottom:"1rem"}}>back to forum</button>

      {/* OP */}
      <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a"}}>
        <div style={{padding:"1.2rem 1.4rem",borderBottom:"1px solid #1a1a1a"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"0.8rem"}}>
            <div>
              <div style={{display:"flex",gap:5,marginBottom:6,flexWrap:"wrap"}}>
                {pinned && <Pill label="PINNED" green/>}
                {locked && <Pill label="LOCKED" dim/>}
                <Pill label={thread.category}/>
              </div>
              <h1 style={{fontSize:"1.15rem",color:"#fff",fontWeight:700,lineHeight:1.3}}>{thread.title}</h1>
            </div>
            {isMod && (
              <div style={{display:"flex",gap:5,flexShrink:0}}>
                <MBtn label={pinned?"Unpin":"Pin"}   onClick={()=>setPinned(!pinned)}/>
                <MBtn label={locked?"Unlock":"Lock"} onClick={()=>setLocked(!locked)}/>
                <MBtn label="Delete" onClick={onBack} red/>
              </div>
            )}
          </div>
        </div>

        <div style={{padding:"0.9rem 1.4rem",borderBottom:"1px solid #1a1a1a",display:"flex",gap:"0.8rem",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:"0.7rem",alignItems:"center"}}>
            <Avi user={author}/>
            <div>
              <div style={{fontSize:12,color:ROLES[author.role].color,fontWeight:700}}>{author.username}</div>
              <div style={{fontSize:10,color:ROLES[author.role].color}}>[{ROLES[author.role].label}]</div>
            </div>
          </div>
          <div style={{fontSize:10,color:"#333",textAlign:"right"}}>
            <div>{new Date(thread.created).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"})}</div>
            <div style={{marginTop:2}}>{fmt(thread.views)} views · {replies.length} replies</div>
          </div>
        </div>

        <div style={{padding:"1.2rem 1.4rem"}}>{renderBody(thread.body)}</div>
        <div style={{padding:"0.7rem 1.4rem",borderTop:"1px solid #111",display:"flex",gap:4,flexWrap:"wrap"}}>
          {thread.tags.map(tg=><TagChip key={tg} t={tg}/>)}
        </div>
        <div style={{padding:"0.5rem 1.4rem 1rem",borderTop:"1px solid #111"}}>
          <ReactBar targetKey={`thread-${thread.id}`} getReact={getReact} toggleReact={(e)=>toggleReact("thread",thread.id,e)}/>
        </div>
      </div>

      {/* Replies */}
      {replies.map((r,i)=>{
        const ru = MOCK_USERS[r.authorId];
        return (
          <div key={r.id} style={{background:i%2===0?"#000":"#050505",border:"1px solid #1a1a1a",borderTop:"none"}}>
            <div style={{padding:"0.9rem 1.4rem",display:"flex",gap:"0.8rem",alignItems:"flex-start"}}>
              <Avi user={ru}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,color:ROLES[ru.role].color,fontWeight:700}}>{ru.username}</span>
                  <span style={{fontSize:10,color:ROLES[ru.role].color}}>[{ROLES[ru.role].label}]</span>
                  <span style={{fontSize:10,color:"#222"}}>·</span>
                  <span style={{fontSize:10,color:"#333"}}>{timeAgo(r.created)}</span>
                  {(isMod || CURRENT_USER.id===r.authorId) && (
                    <button style={{marginLeft:"auto",background:"none",border:"none",fontSize:10,color:"#333"}}>delete</button>
                  )}
                </div>
                {renderBody(r.body)}
                <div style={{marginTop:6}}>
                  <ReactBar targetKey={`reply-${r.id}`} getReact={getReact} toggleReact={(e)=>toggleReact("reply",r.id,e)}/>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Reply box */}
      <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a",borderTop:"none",padding:"1rem 1.4rem"}}>
        {locked ? (
          <div style={{fontSize:11,color:"#444",textAlign:"center",padding:"0.8rem"}}>Thread is locked.</div>
        ) : (
          <>
            <div style={{fontSize:10,color:"#333",marginBottom:6,letterSpacing:"0.1em",textTransform:"uppercase"}}>
              Reply as <span style={{color:ROLES[CURRENT_USER.role].color}}>{CURRENT_USER.username}</span>
              <span style={{marginLeft:8,color:"#222"}}>— paste a GIF url on its own line to embed</span>
            </div>
            <textarea value={replyBody} onChange={e=>setBody(e.target.value)} rows={5} placeholder="Write your reply..."
              style={{width:"100%",background:"#000",border:"1px solid #1a1a1a",padding:"0.6rem 0.8rem",color:"#ccc",fontSize:12,lineHeight:1.7}}/>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
              <button onClick={postReply} disabled={!replyBody.trim()}
                style={{background:replyBody.trim()?"#22c55e":"#111",color:replyBody.trim()?"#000":"#333",border:"none",padding:"6px 18px",fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>
                Post Reply
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReactBar({ targetKey, getReact, toggleReact }) {
  const [, forceUpdate] = useState(0);
  return (
    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
      {REACTIONS.map(e => {
        const count = getReact(...targetKey.split("-"), e);
        const mine  = count > 0;
        return (
          <button key={e} onClick={()=>{toggleReact(e);forceUpdate(n=>n+1)}}
            style={{background:mine?"#0f2d1a":"#0a0a0a",border:`1px solid ${mine?"#22c55e55":"#1a1a1a"}`,padding:"2px 8px",fontSize:10,color:mine?"#22c55e":"#444",display:"flex",gap:4,alignItems:"center"}}>
            {e}{count>0&&<span style={{color:mine?"#22c55e":"#333"}}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── NEW THREAD ──
function NewThreadView({ onBack, onPost }) {
  const [title, setTitle]   = useState("");
  const [body, setBody]     = useState("");
  const [cat, setCat]       = useState("help");
  const [tags, setTags]     = useState([]);
  const [tagInput, setTI]   = useState("");

  const ALL_TAGS = ["bnm","il2cpp","unity","dobby","openxr","quest","vr","vulkan","ndk","cmake","imgui","egl","arm64","hook","android","beginner","template","guide","crash","help","build"];
  const addTag = t => { if(!tags.includes(t)&&tags.length<8) setTags([...tags,t]); };
  const rmTag  = t => setTags(tags.filter(x=>x!==t));
  const onTK   = e => {
    const v = e.target.value;
    if(v.endsWith(" ")||v.endsWith(",")){ const c=v.trim().replace(/,/g,"").toLowerCase().replace(/[^a-z0-9-]/g,""); if(c) addTag(c); setTI(""); } else setTI(v);
  };
  const cats = CATEGORIES.filter(c=>c.slug!=="all");

  const submit = () => {
    if(!title.trim()||!body.trim()) return;
    onPost({ id:Date.now(), authorId:CURRENT_USER.id, category:cat, title:title.trim(), body:body.trim(), tags, pinned:false, locked:false, views:0, created:new Date().toISOString(), replies:[] });
  };

  return (
    <div className="fi" style={{maxWidth:740}}>
      <button onClick={onBack} style={{background:"none",border:"none",fontSize:11,color:"#555",fontFamily:"monospace",marginBottom:"1rem"}}>back</button>
      <h2 style={{fontSize:"1rem",color:"#fff",fontWeight:700,marginBottom:"1.2rem"}}>New Thread</h2>
      <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a",padding:"1.4rem",display:"flex",flexDirection:"column",gap:"1rem"}}>
        <FRow label="Title">
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Thread title"
            style={{width:"100%",background:"#000",border:"1px solid #1a1a1a",padding:"7px 10px",color:"#fff",fontSize:13}}/>
        </FRow>
        <FRow label="Category">
          <select value={cat} onChange={e=>setCat(e.target.value)}
            style={{width:"100%",background:"#000",border:"1px solid #1a1a1a",padding:"7px 10px",color:"#ccc",fontSize:12}}>
            {cats.map(c=><option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
        </FRow>
        <FRow label="Body">
          <textarea value={body} onChange={e=>setBody(e.target.value)} rows={12} placeholder={"Write your post...\n\n# Heading\n```code block```\n- list item\n**bold**"}
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
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
          <button onClick={onBack} style={{background:"none",border:"1px solid #1a1a1a",padding:"6px 14px",fontSize:11,color:"#555"}}>Cancel</button>
          <button onClick={submit} disabled={!title.trim()||!body.trim()}
            style={{background:title.trim()&&body.trim()?"#22c55e":"#111",color:title.trim()&&body.trim()?"#000":"#333",border:"none",padding:"6px 18px",fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>
            Post Thread
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ADMIN ──
function AdminPanelView() {
  const [tab, setTab]     = useState("threads");
  const [threads, setT]   = useState(MOCK_THREADS);
  const [users, setU]     = useState(Object.values(MOCK_USERS));

  const pin  = id => setT(threads.map(t=>t.id===id?{...t,pinned:!t.pinned}:t));
  const lock = id => setT(threads.map(t=>t.id===id?{...t,locked:!t.locked}:t));
  const del  = id => setT(threads.filter(t=>t.id!==id));
  const setRole = (id,role) => setU(users.map(u=>u.id===id?{...u,role}:u));

  return (
    <div className="fi">
      <h2 style={{fontSize:"1rem",color:"#fff",fontWeight:700,marginBottom:"1.2rem"}}>Mod Panel</h2>
      <div style={{display:"flex",gap:2,borderBottom:"1px solid #1a1a1a",marginBottom:"1rem"}}>
        {[["threads","Threads"],["users","Members"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{background:"none",border:"none",borderBottom:`2px solid ${tab===id?"#22c55e":"transparent"}`,padding:"6px 14px",fontSize:11,color:tab===id?"#fff":"#555",fontFamily:"monospace",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:-1}}>
            {label}
          </button>
        ))}
      </div>
      {tab==="threads" && (
        <div style={{border:"1px solid #1a1a1a"}}>
          {threads.map((t,i)=>(
            <div key={t.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"0.8rem",alignItems:"center",padding:"0.7rem 1rem",background:i%2===0?"#0a0a0a":"#000",borderBottom:i===threads.length-1?"none":"1px solid #1a1a1a"}}>
              <div>
                <div style={{fontSize:12,color:"#ddd",marginBottom:2}}>{t.title}</div>
                <div style={{fontSize:10,color:"#333",display:"flex",gap:8}}>
                  <span>{t.category}</span>
                  <span style={{color:ROLES[MOCK_USERS[t.authorId].role].color}}>{MOCK_USERS[t.authorId].username}</span>
                  <span>{fmt(t.views)} views</span>
                </div>
              </div>
              <div style={{display:"flex",gap:4}}>
                <MBtn label={t.pinned?"Unpin":"Pin"}   onClick={()=>pin(t.id)}/>
                <MBtn label={t.locked?"Unlock":"Lock"} onClick={()=>lock(t.id)}/>
                <MBtn label="Delete" onClick={()=>del(t.id)} red/>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab==="users" && (
        <div style={{border:"1px solid #1a1a1a"}}>
          {users.map((u,i)=>(
            <div key={u.id} style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:"0.8rem",alignItems:"center",padding:"0.75rem 1rem",background:i%2===0?"#0a0a0a":"#000",borderBottom:i===users.length-1?"none":"1px solid #1a1a1a"}}>
              <Avi user={u}/>
              <div>
                <div style={{fontSize:12,color:ROLES[u.role].color,fontWeight:700}}>{u.username}</div>
                <div style={{fontSize:10,color:"#333",marginTop:2}}>{u.post_count} posts</div>
              </div>
              {u.id!==CURRENT_USER.id ? (
                <select value={u.role} onChange={e=>setRole(u.id,e.target.value)}
                  style={{background:"#000",border:"1px solid #1a1a1a",padding:"4px 8px",color:ROLES[u.role].color,fontSize:11}}>
                  <option value="member">Member</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              ) : <span style={{fontSize:10,color:ROLES[u.role].color}}>[{ROLES[u.role].label}]</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PROFILE ──
function ProfileView({ user, onOpenThread }) {
  const myThreads = MOCK_THREADS.filter(t=>t.authorId===user.id);
  return (
    <div className="fi">
      <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a",padding:"1.4rem",marginBottom:"1.5rem"}}>
        <div style={{display:"flex",gap:"1rem",alignItems:"center",flexWrap:"wrap"}}>
          <Avi user={user} size={44}/>
          <div>
            <div style={{fontSize:"1.1rem",color:ROLES[user.role].color,fontWeight:700}}>{user.username}</div>
            <div style={{fontSize:10,color:ROLES[user.role].color,marginTop:2}}>[{ROLES[user.role].label}]</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:"1.5rem"}}>
            {[["Posts",user.post_count],["Threads",myThreads.length]].map(([l,v])=>(
              <div key={l} style={{textAlign:"right"}}>
                <div style={{fontSize:"1rem",color:"#22c55e",fontWeight:700}}>{v}</div>
                <div style={{fontSize:10,color:"#333",textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SLabel>My Threads</SLabel>
      <div style={{marginTop:8,border:"1px solid #1a1a1a"}}>
        {myThreads.map((t,i)=><TRow key={t.id} t={t} onClick={()=>onOpenThread(t)} last={i===myThreads.length-1}/>)}
      </div>
    </div>
  );
}

// ── SHARED ──
function Avi({ user, size=28 }) {
  const c = ROLES[user?.role]?.color||"#333";
  const l = (user?.username||"?")[0].toUpperCase();
  return <div style={{width:size,height:size,borderRadius:2,background:"#0a0a0a",border:`1px solid ${c}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.42,color:c,fontWeight:700,flexShrink:0}}>{l}</div>;
}
function Pill({ label, green, dim }) {
  const c = green?"#22c55e":dim?"#555":"#444";
  return <span style={{fontSize:9,padding:"1px 5px",background:`${c}14`,color:c,border:`1px solid ${c}33`,letterSpacing:"0.08em"}}>{label}</span>;
}
function TagChip({ t, active, onClick }) {
  return <span onClick={onClick} style={{fontSize:10,padding:"1px 6px",background:active?"#0f2d1a":"#0a0a0a",color:active?"#22c55e":"#444",border:`1px solid ${active?"#166534":"#1a1a1a"}`,cursor:onClick?"pointer":"default",userSelect:"none",transition:"all 0.1s"}}>#{t}</span>;
}
function MBtn({ label, onClick, red }) {
  const c = red?"#ef4444":"#555";
  return <button onClick={onClick} style={{background:"none",border:`1px solid ${c}33`,padding:"2px 8px",fontSize:10,color:c,letterSpacing:"0.05em"}}>{label}</button>;
}
function SLabel({ children }) {
  return <div style={{fontSize:10,color:"#333",letterSpacing:"0.15em",textTransform:"uppercase"}}>{children}</div>;
}
function FRow({ label, children }) {
  return <div><div style={{fontSize:10,color:"#555",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:5}}>{label}</div>{children}</div>;
}
function LInput({ label, value, onChange, placeholder, type="text" }) {
  return <div>
    <div style={{fontSize:10,color:"#555",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>{label}</div>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:"100%",background:"#000",border:"1px solid #1a1a1a",padding:"7px 10px",color:"#fff",fontSize:12}}/>
  </div>;
}
