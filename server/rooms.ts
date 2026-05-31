import type { FastifyInstance } from "fastify";

// ── GOVERNANCE DATA ───────────────────────────────────────────────────────

const GOV = {
  chain: "Arbitrum One (42161)",
  safe: "0x7b281C5d9F863e50264aA7F7583C2d5626ed4501",
  safeThreshold: "2-of-2",
  timelock: "NOT DEPLOYED",
  guardian: "NOT DEPLOYED",
  contracts: [
    { name: "VyrdonBoundary", address: "0x92CA07e8C051D9c77dC0b422b7c791FA13B18961", status: "SEALED", control: "owner() = Safe" },
    { name: "ExecutionSeal", address: "0x9b9b7BfA27b162b9C515F382592613C74a4E5ac4", status: "IMMUTABLE", control: "ownerless" },
    { name: "EscrowVault", address: "0x4C16a1C25cd55748F6997BE60142eAA6E00E34e7", status: "IMMUTABLE", control: "boundary-locked" },
    { name: "VyrdonCore", address: "0x4C13bBD3996455ED8a7662ec9D53F20f4b1B805A", status: "IMMUTABLE", control: "ownerless" },
    { name: "ASRSATAIntentAnchor", address: "0x76c545299Bc6bcbDFA06026E3368c6e1EFaFacFA", status: "IMMUTABLE", control: "ownerless" },
    { name: "ASRSATA", address: "0x5f13240C70aA7BfEdD76cD70F906d70CC0515573", status: "IMMUTABLE", control: "fixed-supply" },
  ],
};

// ── SHARED STYLES ─────────────────────────────────────────────────────────

const S = `<style>
:root{--bg:#000;--fg:#f0f0f0;--g:#00ff88;--gd:#00cc6a;--r:#ff2244;--y:#ffaa00;--b:#00ccff;--p:#aa66ff;--o:#ff6600;--pk:#ff2266;--g1:#0a0a0a;--g2:#141414;--g3:#1a1a1a;--g4:#222;--g5:#555}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font-family:'Space Mono',monospace;-webkit-font-smoothing:antialiased;min-height:100vh;cursor:crosshair}
#bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
a{color:var(--g);text-decoration:none}a:hover{text-decoration:underline}
.page{max-width:1200px;margin:0 auto;padding:2rem 2.5rem;min-height:100vh;position:relative;z-index:1}

/* TOP NAV — cinematic — visible immediately, GSAP enhances */
.topnav{position:sticky;top:0;z-index:100;background:rgba(0,0,0,.88);backdrop-filter:blur(14px);border-bottom:1px solid var(--g3);padding:.8rem 0;margin-bottom:2rem;display:flex;align-items:center;gap:.3rem;flex-wrap:wrap}
.topnav-brand{font-family:'Bebas Neue',sans-serif;font-size:1.4rem;letter-spacing:.15em;margin-right:1.5rem;color:var(--g);padding:0 .5rem}
.topnav-brand span{color:#fff}
.topnav a.tn{font-family:'Bebas Neue',sans-serif;font-size:.82rem;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;padding:.5rem .9rem;color:var(--g5);border:1px solid transparent;transition:all .25s}
.topnav a.tn:hover{color:var(--fg);border-color:var(--g3);text-decoration:none}
.topnav a.tn.active{color:var(--g);border-color:var(--g3);background:rgba(0,255,136,.04)}

/* ROOM NAV — sub nav below top — visible immediately */
.nav{display:flex;align-items:center;gap:1.5rem;margin-bottom:2rem}
.nav-back{font-size:1.8rem;color:var(--g);text-decoration:none;transition:all .2s;line-height:1;padding:.2rem .5rem}
.nav-back:hover{color:#fff;transform:translateX(-4px);text-decoration:none}
.nav-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(1.5rem,4vw,2.5rem);letter-spacing:.12em}
.nav-badge{font-size:.55rem;letter-spacing:.3em;text-transform:uppercase;padding:.3rem .8rem;border:1px solid var(--g3);color:var(--g5);margin-left:auto}

/* KPI */
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1.2rem;margin-bottom:2.5rem}
.kpi{border:1px solid var(--g3);padding:1.8rem;text-align:center;background:var(--g1);position:relative;overflow:hidden;transition:border-color .3s,box-shadow .4s,transform .3s}
.kpi:hover{border-color:var(--g4);transform:translateY(-4px)!important;box-shadow:0 0 40px rgba(255,255,255,.04)}
.kpi::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px}
.kpi-val{font-family:'Bebas Neue',sans-serif;font-size:clamp(2rem,4vw,2.8rem);line-height:1.1}
.kpi-label{font-size:.58rem;color:var(--g5);letter-spacing:.25em;text-transform:uppercase;margin-top:.5rem}

/* CARDS */
.card{border:1px solid var(--g3);padding:2rem;margin-bottom:1.8rem;background:var(--g1);position:relative;transition:border-color .3s,box-shadow .4s,transform .3s}
.card:hover{border-color:var(--g4);box-shadow:0 0 40px rgba(255,255,255,.04)}
.card-hd{font-family:'Bebas Neue',sans-serif;font-size:1.15rem;letter-spacing:.15em;margin-bottom:1.2rem;padding-bottom:.8rem;border-bottom:1px solid var(--g2);display:flex;align-items:center;gap:.8rem}
.card-hd .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.row{display:flex;justify-content:space-between;align-items:center;padding:.6rem 0;border-bottom:1px solid #0c0c0c;font-size:.75rem;gap:1rem}
.row:last-child{border-bottom:none}
.row .l{color:var(--g5);flex-shrink:0}.row .v{color:#ccc;text-align:right;word-break:break-all}
.grid{display:grid;gap:1.8rem}.g2{grid-template-columns:repeat(auto-fit,minmax(340px,1fr))}.g3{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}

/* TABLE */
table{width:100%;border-collapse:collapse;font-size:.72rem}
th{text-align:left;padding:.8rem;border-bottom:2px solid var(--g3);color:var(--g);font-family:'Bebas Neue',sans-serif;letter-spacing:.15em;font-size:.8rem}
td{padding:.8rem;border-bottom:1px solid #0c0c0c;color:#bbb}

/* SEAL ITEMS */
.si{border:1px solid var(--g2);padding:1.2rem;margin-bottom:.8rem;background:var(--bg);transition:all .2s}
.si:hover{border-color:var(--g4);background:var(--g1)}
.si-head{display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:.4rem}
.si-id{font-family:monospace;font-size:.72rem;color:var(--g)}
.si-time{font-size:.6rem;color:#333}
.si-body{font-size:.68rem;color:#666;margin:.3rem 0}
.si-hash{font-family:monospace;font-size:.55rem;color:#2a2a2a}
.pl{color:var(--g);font-size:.68rem;letter-spacing:.08em;text-decoration:none;display:inline-block;margin-top:.4rem}
.pl:hover{color:#fff}

/* CALENDAR */
.cal-day{margin-bottom:1.5rem}
.cal-day-hd{font-family:'Bebas Neue',sans-serif;font-size:1rem;letter-spacing:.12em;color:var(--g);padding:.6rem 0;border-bottom:1px solid var(--g3);margin-bottom:.6rem}
.cal-item{display:flex;align-items:center;gap:1rem;padding:.7rem 1rem;border-left:3px solid var(--g3);margin-bottom:.3rem;font-size:.72rem;transition:all .2s;background:transparent}
.cal-item:hover{background:var(--g1);border-left-color:var(--g)}
.cal-cat{font-family:'Bebas Neue',sans-serif;font-size:.62rem;letter-spacing:.1em;padding:.15rem .5rem;border:1px solid;min-width:70px;text-align:center;flex-shrink:0}
.cal-cat.commercial{color:var(--g);border-color:var(--g)}.cal-cat.operations{color:var(--b);border-color:var(--b)}.cal-cat.policy{color:var(--pk);border-color:var(--pk)}.cal-cat.evidence{color:var(--o);border-color:var(--o)}.cal-cat.executive{color:var(--p);border-color:var(--p)}
.cal-title{flex:1;color:#ccc}.cal-status{font-size:.6rem;letter-spacing:.1em;font-family:'Bebas Neue',sans-serif}
.cal-status.overdue{color:var(--r)}.cal-status.due{color:var(--y)}.cal-status.scheduled{color:var(--g5)}.cal-status.completed{color:var(--g)}.cal-status.blocked{color:var(--pk)}
.cal-time{font-size:.55rem;color:#333;font-family:monospace}

/* MISC */
.ft{text-align:center;padding:3rem 0;font-size:.5rem;color:#1a1a1a;letter-spacing:.3em;border-top:1px solid #0a0a0a;margin-top:3rem}
.inp{width:100%;padding:.8rem 1rem;background:var(--g1);border:1px solid var(--g3);color:var(--fg);font-family:'Space Mono',monospace;font-size:.75rem}
.inp:focus{border-color:var(--g);outline:none}
.btn{padding:.8rem 2.5rem;font-family:'Bebas Neue',sans-serif;font-size:1rem;letter-spacing:.15em;background:var(--g);color:#000;border:none;cursor:pointer;transition:all .2s}
.btn:hover{background:#fff;transform:translateY(-1px)}
.btn-sm{padding:.4rem 1.2rem;font-size:.75rem}
.alert{padding:1.2rem 1.5rem;margin-bottom:1.5rem;font-size:.75rem;background:var(--g1)}
.alert-w{border-left:3px solid var(--y);color:var(--y)}.alert-e{border-left:3px solid var(--r);color:var(--r)}
.enforce{font-family:'Bebas Neue',sans-serif;letter-spacing:.1em;font-size:.85rem;color:var(--g);text-align:center;padding:1.5rem;border:1px solid var(--g3);background:var(--g1);margin-bottom:2rem}
.prose{font-size:.82rem;line-height:2;color:#888;max-width:750px}
.prose h2{font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:var(--fg);letter-spacing:.1em;margin:2.5rem 0 1rem;padding-bottom:.5rem;border-bottom:1px solid var(--g3)}
.prose h3{font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:#ccc;letter-spacing:.08em;margin:2rem 0 .5rem}
.prose p{margin-bottom:1.2rem}.prose ul{margin:0 0 1.2rem 1.5rem;color:#777}.prose li{margin-bottom:.5rem}
.prose strong{color:var(--fg)}
@media(max-width:700px){.page{padding:1.5rem 1rem}.kpi-grid{grid-template-columns:1fr 1fr}.g2,.g3{grid-template-columns:1fr}.topnav{gap:.1rem}.topnav a.tn{font-size:.65rem;padding:.4rem .5rem}.nav-badge{display:none}}
@media(max-width:450px){.kpi-grid{grid-template-columns:1fr}}
</style>`;

// ── SHARED HEAD ────────────────────────────────────────────────────────────

const H = `<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>${S}`;

// ── TOP NAVIGATION ────────────────────────────────────────────────────────

const TNAV = (active: string) => {
  const items = [
    { href: "/", label: "OVERVIEW", id: "overview" },
    { href: "/rooms/calendar", label: "CALENDAR", id: "calendar" },
    { href: "/rooms/revenue", label: "REVENUE", id: "revenue" },
    { href: "/rooms/operations", label: "OPERATIONS", id: "operations" },
    { href: "/rooms/evidence", label: "AUDIT", id: "evidence" },
    { href: "/rooms/policy", label: "RISK", id: "policy" },
    { href: "/rooms/camps", label: "ABOUT", id: "camps" },
    { href: "/rooms/monitor", label: "MONITOR", id: "monitor" },
  ];
  return `<nav class="topnav" id="topnav">
    <div class="topnav-brand"><span>VYRD</span>X</div>
    ${items.map(i => `<a href="${i.href}" class="tn${i.id === active ? " active" : ""}">${i.label}</a>`).join("")}
  </nav>`;
};

const FT = (room: string) => `<div class="ft">VYRDON PROTOCOL · VYRDX.VYRDON.COM · ${room} · ENFORCED</div>`;

// ── THREE.JS PARTICLE BACKGROUND + GSAP ENTRANCE ─────────────────────────

const ROOM_BG = `
<script>
(function(){
  try{
    var c=document.getElementById('bg');if(!c)return;
    var r=new THREE.WebGLRenderer({canvas:c,alpha:true,antialias:true});
    r.setSize(innerWidth,innerHeight);r.setPixelRatio(Math.min(devicePixelRatio,2));
    var s=new THREE.Scene(),cam=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,0.1,1000);cam.position.z=5;
    var n=600,g=new THREE.BufferGeometry(),p=new Float32Array(n*3),cl=new Float32Array(n*3);
    for(var i=0;i<n;i++){p[i*3]=(Math.random()-.5)*30;p[i*3+1]=(Math.random()-.5)*30;p[i*3+2]=(Math.random()-.5)*30;
      var v=Math.random();if(v>.92){cl[i*3]=0;cl[i*3+1]=1;cl[i*3+2]=.53}else if(v>.84){cl[i*3]=0;cl[i*3+1]=.8;cl[i*3+2]=1}else if(v>.76){cl[i*3]=1;cl[i*3+1]=.4;cl[i*3+2]=0}else{var x=.06+Math.random()*.08;cl[i*3]=x;cl[i*3+1]=x;cl[i*3+2]=x}}
    g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(cl,3));
    var m=new THREE.PointsMaterial({size:.02,vertexColors:true,transparent:true,opacity:.6}),pts=new THREE.Points(g,m);s.add(pts);
    var pg=new THREE.PlaneGeometry(16,4,28,7),pm=new THREE.MeshBasicMaterial({color:0x060606,wireframe:true,transparent:true,opacity:.08}),pl=new THREE.Mesh(pg,pm);pl.position.z=-12;s.add(pl);
    var mx=0,my=0;document.addEventListener('mousemove',function(e){mx=(e.clientX/innerWidth-.5)*2;my=(e.clientY/innerHeight-.5)*2});
    (function a(){requestAnimationFrame(a);pts.rotation.y+=.00015;pts.rotation.x+=.00006;pl.rotation.y=mx*.04;pl.rotation.x=-my*.04;cam.position.x+=(mx*.3-cam.position.x)*.01;cam.position.y+=(-my*.3-cam.position.y)*.01;cam.lookAt(s.position);r.render(s,cam)})();
    addEventListener('resize',function(){cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();r.setSize(innerWidth,innerHeight)});
  }catch(e){/* Three.js unavailable — page content still visible */}
})();
<\/script>`;


// ═══════════════════════════════════════════════════════════════════════════
// ROUTE REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════

export async function registerRoomRoutes(server: FastifyInstance, mode = "local"): Promise<void> {

  // ═══════════════════════════════════════════════════════════════════════
  // LANDING
  // CLOUD: Three.js hero with room cards
  // LOCAL: Full-screen TV Wall — clickable panels per room, live status
  // ═══════════════════════════════════════════════════════════════════════
  if (mode === "cloud") {
    server.get("/", async (_req, reply) => {
      return reply.type("text/html").send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>VYRDX — VYRDON Certified Execution Protocol</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#f0f0f0;font-family:'Space Mono',monospace;overflow-x:hidden;cursor:crosshair}
#bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0}
.w{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:2rem}
.topbar{position:fixed;top:0;left:0;right:0;z-index:10;display:flex;align-items:center;gap:.3rem;padding:.8rem 2rem;background:rgba(0,0,0,.7);backdrop-filter:blur(14px);border-bottom:1px solid #111}
.topbar-brand{font-family:'Bebas Neue',sans-serif;font-size:1.2rem;letter-spacing:.15em;margin-right:1.5rem}
.topbar-brand span{color:#00ff88}
.topbar a{font-family:'Bebas Neue',sans-serif;font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;padding:.4rem .7rem;color:#444;transition:color .2s}
.topbar a:hover{color:#f0f0f0;text-decoration:none}
.mark{font-family:'Bebas Neue',sans-serif;font-size:clamp(5rem,15vw,10rem);letter-spacing:.2em;text-align:center;line-height:1}
.mark span{color:#00ff88}
.sub{font-size:clamp(.6rem,1.3vw,.8rem);letter-spacing:.5em;text-transform:uppercase;color:#2a2a2a;text-align:center;margin-bottom:1rem}
.enforce-line{font-family:'Bebas Neue',sans-serif;font-size:clamp(.8rem,2vw,1.2rem);letter-spacing:.2em;color:#00ff88;text-align:center;margin-bottom:4rem}
.rooms{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.8rem;max-width:1300px;width:100%;padding:0 2rem}
.rb{border:2px solid #111;padding:2.5rem 1.8rem;text-align:center;cursor:pointer;position:relative;overflow:hidden;transition:transform .4s,border-color .3s,box-shadow .4s;text-decoration:none;color:inherit;display:block;min-height:220px}
.rb::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;opacity:0;transition:opacity .5s}
.rb:hover{transform:translateY(-10px)}
.rb:hover::before{opacity:1}
.rb:nth-child(1){--c:#00ff88}.rb:nth-child(1):hover{border-color:#00ff88;box-shadow:0 0 60px rgba(0,255,136,.12)}.rb:nth-child(1)::before{background:radial-gradient(ellipse at 50% 100%,rgba(0,255,136,.1),transparent 70%)}
.rb:nth-child(2){--c:#ffaa00}.rb:nth-child(2):hover{border-color:#ffaa00;box-shadow:0 0 60px rgba(255,170,0,.12)}.rb:nth-child(2)::before{background:radial-gradient(ellipse at 50% 100%,rgba(255,170,0,.1),transparent 70%)}
.rb:nth-child(3){--c:#00ccff}.rb:nth-child(3):hover{border-color:#00ccff;box-shadow:0 0 60px rgba(0,204,255,.12)}.rb:nth-child(3)::before{background:radial-gradient(ellipse at 50% 100%,rgba(0,204,255,.1),transparent 70%)}
.rb:nth-child(4){--c:#00ff88}.rb:nth-child(4):hover{border-color:#00ff88;box-shadow:0 0 60px rgba(0,255,136,.12)}.rb:nth-child(4)::before{background:radial-gradient(ellipse at 50% 100%,rgba(0,255,136,.1),transparent 70%)}
.rb:nth-child(5){--c:#ff6600}.rb:nth-child(5):hover{border-color:#ff6600;box-shadow:0 0 60px rgba(255,102,0,.12)}.rb:nth-child(5)::before{background:radial-gradient(ellipse at 50% 100%,rgba(255,102,0,.1),transparent 70%)}
.rb:nth-child(6){--c:#ff2266}.rb:nth-child(6):hover{border-color:#ff2266;box-shadow:0 0 60px rgba(255,34,102,.12)}.rb:nth-child(6)::before{background:radial-gradient(ellipse at 50% 100%,rgba(255,34,102,.1),transparent 70%)}
.rb-dot{position:absolute;top:1rem;right:1rem;width:8px;height:8px;border-radius:50%;background:#00ff88}
.rb-icon{font-size:3rem;margin-bottom:1rem;position:relative;z-index:1}
.rb-name{font-family:'Bebas Neue',sans-serif;font-size:1.6rem;letter-spacing:.15em;margin-bottom:.6rem;position:relative;z-index:1;color:var(--c)}
.rb-desc{font-size:.55rem;color:#444;line-height:1.7;position:relative;z-index:1;max-width:200px;margin:0 auto}
.stats{font-size:.6rem;color:#222;text-align:center;margin-top:3rem;letter-spacing:.2em}
.ft{text-align:center;padding:2rem 0;font-size:.45rem;color:#111;letter-spacing:.35em;margin-top:2rem}
@media(max-width:900px){.rooms{grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1.2rem}.rb{min-height:180px;padding:1.8rem 1rem}}
@media(max-width:450px){.rooms{grid-template-columns:1fr 1fr}}
</style></head><body>
<canvas id="bg"></canvas>
<div class="topbar" id="topbar">
  <div class="topbar-brand"><span>VYRD</span>X</div>
  <a href="/">OVERVIEW</a>
  <a href="/rooms/calendar">CALENDAR</a>
  <a href="/rooms/revenue">REVENUE</a>
  <a href="/rooms/operations">OPERATIONS</a>
  <a href="/rooms/evidence">AUDIT</a>
  <a href="/rooms/policy">RISK</a>
  <a href="/rooms/camps">ABOUT</a>
  <a href="/rooms/monitor">MONITOR</a>
</div>
<div class="w">
  <div class="mark" id="mark">VYRD<span>X</span></div>
  <div class="sub" id="sub">Certified Execution Protocol</div>
  <div class="enforce-line" id="enforce">Safe-Governed · Immutable Core · No EOA Admin · Enforced</div>
  <div class="rooms" id="rooms">
    <a href="/rooms/calendar" class="rb"><div class="rb-dot"></div><div class="rb-icon">▦</div><div class="rb-name">CALENDAR</div><div class="rb-desc">Business timeline · Deadlines · Launches · Deploy windows · Reviews</div></a>
    <a href="/rooms/revenue" class="rb"><div class="rb-dot"></div><div class="rb-icon">◆</div><div class="rb-name">REVENUE</div><div class="rb-desc">Revenue metrics · Seal economics · Billing intelligence · Growth</div></a>
    <a href="/rooms/operations" class="rb"><div class="rb-dot"></div><div class="rb-icon">◈</div><div class="rb-name">OPERATIONS</div><div class="rb-desc">System health · Service monitoring · Deployment state · Runtime</div></a>
    <a href="/rooms/evidence" class="rb"><div class="rb-dot"></div><div class="rb-icon">◇</div><div class="rb-name">AUDIT</div><div class="rb-desc">Seal chain · Hash verification · Proof generation · Chain integrity</div></a>
    <a href="/rooms/policy" class="rb"><div class="rb-dot"></div><div class="rb-icon">□</div><div class="rb-name">RISK</div><div class="rb-desc">Governance · Access enforcement · System posture · Authority chain</div></a>
    <a href="/rooms/camps" class="rb"><div class="rb-dot"></div><div class="rb-icon">◊</div><div class="rb-name">ABOUT</div><div class="rb-desc">The Seven Laws · Architecture · Protocol · Contact · Licenses</div></a>
    <a href="/rooms/monitor" class="rb"><div class="rb-dot" style="background:#ff9f4a"></div><div class="rb-icon">◍</div><div class="rb-name">MONITOR</div><div class="rb-desc">Cloud runtime · VYRDx health · Services · Boundary status · Live</div></a>
  </div>
  <div class="stats" id="stats"></div>
  <div class="ft">VYRDON · THE PROTOCOL IS THE LAW · 2026</div>
</div>
<script>
(function(){
  try{
    var c=document.getElementById('bg'),r=new THREE.WebGLRenderer({canvas:c,alpha:true,antialias:true});
    r.setSize(innerWidth,innerHeight);r.setPixelRatio(Math.min(devicePixelRatio,2));
    var s=new THREE.Scene(),cam=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,0.1,1000);cam.position.z=5;
    var n=1000,g=new THREE.BufferGeometry(),p=new Float32Array(n*3),cl=new Float32Array(n*3);
    for(var i=0;i<n;i++){p[i*3]=(Math.random()-.5)*25;p[i*3+1]=(Math.random()-.5)*25;p[i*3+2]=(Math.random()-.5)*25;
      var v=Math.random();if(v>.9){cl[i*3]=0;cl[i*3+1]=1;cl[i*3+2]=.53}else if(v>.8){cl[i*3]=0;cl[i*3+1]=.8;cl[i*3+2]=1}else if(v>.7){cl[i*3]=1;cl[i*3+1]=.4;cl[i*3+2]=0}else{var x=.08+Math.random()*.1;cl[i*3]=x;cl[i*3+1]=x;cl[i*3+2]=x}}
    g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(cl,3));
    var m=new THREE.PointsMaterial({size:.025,vertexColors:true,transparent:true,opacity:.7}),pts=new THREE.Points(g,m);s.add(pts);
    var pg=new THREE.PlaneGeometry(14,3.5,24,6),pm=new THREE.MeshBasicMaterial({color:0x080808,wireframe:true,transparent:true,opacity:.12}),pl=new THREE.Mesh(pg,pm);pl.position.z=-10;s.add(pl);
    var mx=0,my=0;document.addEventListener('mousemove',function(e){mx=(e.clientX/innerWidth-.5)*2;my=(e.clientY/innerHeight-.5)*2});
    (function a(){requestAnimationFrame(a);pts.rotation.y+=.0002;pts.rotation.x+=.00008;pl.rotation.y=mx*.06;pl.rotation.x=-my*.06;cam.position.x+=(mx*.4-cam.position.x)*.015;cam.position.y+=(-my*.4-cam.position.y)*.015;cam.lookAt(s.position);r.render(s,cam)})();
    addEventListener('resize',function(){cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();r.setSize(innerWidth,innerHeight)});
  }catch(e){}
})();
fetch('/health').then(function(r){return r.json()}).then(function(d){document.getElementById('stats').textContent='UPTIME '+(d.uptime_human||Math.floor(d.uptime/3600)+'h')+' · MODE '+d.mode.toUpperCase()+' · CHAIN INTACT'}).catch(function(){});
<\/script></body></html>`);
    });
  } else {
    // ─── LOCAL MODE: KITTY TV WALL ─────────────────────────────────────────
    // Full-screen grid of clickable TV panels. Each panel = one room.
    // Panels show live status fetched from the API.
    server.get("/", async (_req, reply) => {
      const panels = [
        { href: "/rooms/calendar",   label: "CALENDAR",   icon: "▦", color: "#00ccff", desc: "Timeline · Deadlines · Launches",         id: "calendar"   },
        { href: "/rooms/revenue",    label: "REVENUE",    icon: "◆", color: "#00ff88", desc: "Commercial · Seals · Billing",             id: "revenue"    },
        { href: "/rooms/operations", label: "OPERATIONS", icon: "◈", color: "#ffaa00", desc: "Services · Deployments · Health",          id: "operations" },
        { href: "/rooms/evidence",   label: "AUDIT",      icon: "◇", color: "#ff6600", desc: "Seal chain · Hash proofs · Integrity",     id: "evidence"   },
        { href: "/rooms/policy",     label: "RISK",       icon: "□", color: "#ff2266", desc: "Governance · Access · Authority chain",    id: "policy"     },
        { href: "/rooms/camps",      label: "ABOUT",      icon: "◊", color: "#aa66ff", desc: "Protocol · Laws · Architecture",           id: "camps"      },
        { href: "/rooms/monitor",    label: "MONITOR",    icon: "◍", color: "#ff9f4a", desc: "Engine dir · Market feed · Cloud health",  id: "monitor"    },
      ];
      const panelHtml = panels.map((p, i) => `
        <a href="${p.href}" class="tv-panel" data-room="${p.id}" style="--pc:${p.color};animation-delay:${i * 0.06}s">
          <div class="tv-scanline"></div>
          <div class="tv-corner tl"></div><div class="tv-corner tr"></div>
          <div class="tv-corner bl"></div><div class="tv-corner br"></div>
          <div class="tv-body">
            <div class="tv-icon">${p.icon}</div>
            <div class="tv-label">${p.label}</div>
            <div class="tv-desc">${p.desc}</div>
            <div class="tv-status" id="tvs-${p.id}">
              <span class="tv-dot"></span><span class="tv-stat-txt">CONNECTING…</span>
            </div>
          </div>
          <div class="tv-footer">
            <span class="tv-link">OPEN ROOM →</span>
          </div>
        </a>`).join("");

      return reply.type("text/html").send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>KITTY VXSTATION — Control Plane</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#000;overflow:hidden}
body{font-family:'Space Mono',monospace;color:#f0f0f0;cursor:crosshair}

/* TOP HUD */
.hud{position:fixed;top:0;left:0;right:0;z-index:100;height:44px;background:rgba(0,0,0,.92);backdrop-filter:blur(12px);border-bottom:1px solid #111;display:flex;align-items:center;padding:0 1.5rem;gap:1.2rem}
.hud-brand{font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.2em;color:#00ff88;margin-right:.8rem}
.hud-brand span{color:#fff}
.hud-nav a{font-family:'Bebas Neue',sans-serif;font-size:.7rem;letter-spacing:.18em;text-decoration:none;color:#333;padding:.3rem .6rem;transition:color .2s}
.hud-nav a:hover{color:#f0f0f0}
.hud-sep{width:1px;height:18px;background:#111;flex-shrink:0}
.hud-right{margin-left:auto;display:flex;align-items:center;gap:1rem;font-size:.55rem;letter-spacing:.15em;color:#333}
.hud-live{display:flex;align-items:center;gap:.4rem;color:#00ff88}
.hud-live::before{content:'';width:6px;height:6px;border-radius:50%;background:#00ff88;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.hud-time{color:#333;font-size:.5rem;letter-spacing:.12em}

/* TV WALL */
.tv-wall{position:fixed;top:44px;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(2,1fr);gap:2px;background:#050505}

/* TV PANEL */
.tv-panel{position:relative;background:#050505;border:1px solid #111;overflow:hidden;text-decoration:none;color:inherit;display:flex;flex-direction:column;transition:border-color .3s,box-shadow .3s;animation:panelIn .5s ease both}
@keyframes panelIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
.tv-panel:hover{border-color:var(--pc);box-shadow:inset 0 0 60px rgba(0,0,0,.4),0 0 0 1px var(--pc),0 0 40px color-mix(in srgb,var(--pc) 15%,transparent);z-index:2}
.tv-panel:hover .tv-label{color:var(--pc)}
.tv-panel:hover .tv-icon{transform:scale(1.15);color:var(--pc)}
.tv-panel:hover .tv-footer{opacity:1}
.tv-panel:hover .tv-scanline{opacity:.04}

/* Scanline overlay */
.tv-scanline{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.15) 2px,rgba(0,0,0,.15) 4px);pointer-events:none;z-index:1;opacity:.02;transition:opacity .3s}

/* Corner brackets */
.tv-corner{position:absolute;width:14px;height:14px;border-color:var(--pc);border-style:solid;opacity:.4;transition:opacity .3s;z-index:2}
.tv-panel:hover .tv-corner{opacity:1}
.tl{top:8px;left:8px;border-width:1px 0 0 1px}
.tr{top:8px;right:8px;border-width:1px 1px 0 0}
.bl{bottom:8px;left:8px;border-width:0 0 1px 1px}
.br{bottom:8px;right:8px;border-width:0 1px 1px 0}

/* Panel body */
.tv-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem;position:relative;z-index:3}
.tv-icon{font-size:clamp(2rem,4vw,3.5rem);color:#222;transition:all .3s;margin-bottom:.8rem;line-height:1}
.tv-label{font-family:'Bebas Neue',sans-serif;font-size:clamp(1.4rem,3vw,2.2rem);letter-spacing:.18em;color:#ccc;margin-bottom:.5rem;transition:color .3s}
.tv-desc{font-size:clamp(.42rem,.7vw,.58rem);color:#333;letter-spacing:.1em;text-align:center;line-height:1.6;margin-bottom:1rem}

/* Status badge */
.tv-status{display:flex;align-items:center;gap:.5rem;font-size:.5rem;letter-spacing:.12em}
.tv-dot{width:5px;height:5px;border-radius:50%;background:#333;flex-shrink:0;transition:background .3s}
.tv-status.live .tv-dot{background:#00ff88;box-shadow:0 0 6px #00ff88;animation:pulse 2s infinite}
.tv-status.warn .tv-dot{background:#ffaa00;box-shadow:0 0 6px #ffaa00}
.tv-status.down .tv-dot{background:#ff2244;box-shadow:0 0 6px #ff2244}
.tv-stat-txt{color:#333;transition:color .3s}
.tv-status.live .tv-stat-txt{color:#00ff88}
.tv-status.warn .tv-stat-txt{color:#ffaa00}
.tv-status.down .tv-stat-txt{color:#ff2244}

/* Footer */
.tv-footer{position:absolute;bottom:10px;left:0;right:0;text-align:center;opacity:0;transition:opacity .3s;z-index:3}
.tv-link{font-family:'Bebas Neue',sans-serif;font-size:.65rem;letter-spacing:.25em;color:var(--pc)}

/* MONITOR panel spans 2 columns on last row */
.tv-panel:last-child{grid-column:span 2}

/* Bottom ticker */
.ticker{position:fixed;bottom:0;left:0;right:0;height:22px;background:rgba(0,0,0,.9);border-top:1px solid #111;overflow:hidden;display:flex;align-items:center;z-index:100}
.ticker-inner{display:flex;white-space:nowrap;animation:tickerScroll 60s linear infinite}
@keyframes tickerScroll{from{transform:translateX(100vw)}to{transform:translateX(-100%)}}
.ticker-item{font-size:.48rem;letter-spacing:.12em;color:#333;padding:0 2rem}
.ticker-item.hi{color:#00ff88}.ticker-item.warn{color:#ffaa00}.ticker-item.crit{color:#ff2244}

@media(max-width:900px){.tv-wall{grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(4,1fr)}.tv-panel:last-child{grid-column:span 1}}
@media(max-width:550px){.tv-wall{grid-template-columns:1fr;grid-template-rows:none}.tv-panel:last-child{grid-column:span 1}.tv-panel{min-height:120px}}
</style>
</head><body>

<div class="hud">
  <div class="hud-brand"><span>KITTY</span> VXSTATION</div>
  <div class="hud-sep"></div>
  <div class="hud-nav">
    <a href="/rooms/monitor">MONITOR</a>
    <a href="/rooms/operations">OPS</a>
    <a href="/rooms/revenue">REVENUE</a>
    <a href="/rooms/evidence">AUDIT</a>
    <a href="/rooms/policy">RISK</a>
  </div>
  <div class="hud-right">
    <span class="hud-live">LOCAL CONTROL PLANE</span>
    <div class="hud-sep"></div>
    <span class="hud-time" id="hud-clock">--:--:--</span>
    <div class="hud-sep"></div>
    <span id="hud-health">LOADING…</span>
  </div>
</div>

<div class="tv-wall">
  ${panelHtml}
</div>

<div class="ticker">
  <div class="ticker-inner" id="ticker-inner">
    <span class="ticker-item">KITTY VXSTATION — LOCAL OPERATOR PLANE</span>
    <span class="ticker-item hi">PROTOCOL: ACTIVE</span>
    <span class="ticker-item">VYRDX CLOUD: MONITORING</span>
    <span class="ticker-item">ARBITRUM ONE · CHAIN ID 42161</span>
    <span class="ticker-item">SAFE: 0x7b281C5d9F863e50264aA7F7583C2d5626ed4501</span>
    <span class="ticker-item hi">KITTY OBSERVES — NEVER COMMANDS</span>
    <span class="ticker-item">EVIDENCE: APPEND-ONLY JSONL · HASH-CHAINED</span>
    <span class="ticker-item">ZERO TRUST · CLOUDFLARE TUNNELS · TAILSCALE MESH</span>
    <span class="ticker-item hi">LOADING MARKET DATA…</span>
  </div>
</div>

<script>
// Clock
(function clock(){
  var el=document.getElementById('hud-clock');
  function tick(){el.textContent=new Date().toLocaleTimeString('en-US',{hour12:false})}
  tick();setInterval(tick,1000);
})();

// Health check
function loadHealth(){
  fetch('/health').then(function(r){return r.json()}).then(function(d){
    var el=document.getElementById('hud-health');
    var mode=(d.mode||'local').toUpperCase();
    var up=d.uptime_human||Math.floor((d.uptime||0)/60)+'m';
    el.textContent='MODE: '+mode+' · UP: '+up;
    el.style.color='#00ff88';
  }).catch(function(){
    document.getElementById('hud-health').textContent='API UNREACHABLE';
    document.getElementById('hud-health').style.color='#ff2244';
  });
}
loadHealth();
setInterval(loadHealth,30000);

// Panel status — probe each room
var ROOMS=[
  {id:'calendar',  url:'/rooms/calendar'},
  {id:'revenue',   url:'/rooms/revenue'},
  {id:'operations',url:'/rooms/operations'},
  {id:'evidence',  url:'/rooms/evidence'},
  {id:'policy',    url:'/rooms/policy'},
  {id:'camps',     url:'/rooms/camps'},
  {id:'monitor',   url:'/rooms/monitor'},
];

function probeRoom(room){
  var start=Date.now();
  var el=document.getElementById('tvs-'+room.id);
  if(!el)return;
  fetch(room.url,{method:'HEAD'}).then(function(r){
    var ms=Date.now()-start;
    el.className='tv-status '+(r.ok?'live':'down');
    el.querySelector('.tv-stat-txt').textContent=r.ok?'LIVE · '+ms+'ms':'ERROR '+r.status;
  }).catch(function(){
    el.className='tv-status down';
    el.querySelector('.tv-stat-txt').textContent='UNREACHABLE';
  });
}

function probeAll(){ROOMS.forEach(probeRoom)}
probeAll();
setInterval(probeAll,15000);

// Market data ticker
function loadMarket(){
  fetch('/api/monitor/market').then(function(r){return r.json()}).then(function(d){
    if(!d||d.error)return;
    var price=d.price||d.market?.price;
    var items=document.getElementById('ticker-inner');
    if(price&&items){
      var span=document.createElement('span');
      span.className='ticker-item hi';
      span.textContent='BTC/USD '+parseFloat(price).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
      items.appendChild(span);
    }
  }).catch(function(){});
}
loadMarket();
setInterval(loadMarket,30000);
<\/script>
</body></html>`);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CALENDAR — Business command calendar
  // ═══════════════════════════════════════════════════════════════════════
  server.get("/rooms/calendar", async (_req, reply) => {
    return reply.type("text/html").send(`<!DOCTYPE html><html lang="en"><head><title>Calendar — VYRDX</title>${H}</head><body>
    <canvas id="bg"></canvas>
    <div class="page">
      ${TNAV("calendar")}
      <div class="nav"><div class="nav-title" style="color:#ffaa00">BUSINESS CALENDAR</div><div class="nav-badge">COMMAND TIMELINE</div></div>
      <div class="enforce">WHAT IS MOVING THROUGH TIME · DEADLINES · LAUNCHES · DEPLOYS · REVIEWS · NO DRIFT</div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-val" style="color:#ffaa00" id="cal-today">—</div><div class="kpi-label">TODAY</div><style>.kpi:nth-child(1)::after{background:#ffaa00}</style></div>
        <div class="kpi"><div class="kpi-val" style="color:#00ccff" id="cal-week">—</div><div class="kpi-label">THIS WEEK</div><style>.kpi:nth-child(2)::after{background:#00ccff}</style></div>
        <div class="kpi"><div class="kpi-val" style="color:#ff2244" id="cal-overdue">—</div><div class="kpi-label">OVERDUE</div><style>.kpi:nth-child(3)::after{background:#ff2244}</style></div>
        <div class="kpi"><div class="kpi-val" style="color:#00ff88" id="cal-upcoming">—</div><div class="kpi-label">UPCOMING</div><style>.kpi:nth-child(4)::after{background:#00ff88}</style></div>
      </div>

      <div class="grid g2">
        <div class="card"><div class="card-hd"><div class="dot" style="background:#ff2244"></div> OVERDUE — REQUIRES ACTION</div>
          <div id="overdue-list">Loading...</div>
        </div>
        <div class="card"><div class="card-hd"><div class="dot" style="background:#ffaa00"></div> TODAY</div>
          <div id="today-list">Loading...</div>
        </div>
      </div>

      <div class="card"><div class="card-hd"><div class="dot" style="background:#00ccff"></div> THIS WEEK</div>
        <div id="week-view">Loading...</div>
      </div>

      <div class="grid g2">
        <div class="card"><div class="card-hd"><div class="dot" style="background:#00ff88"></div> UPCOMING BY CATEGORY</div>
          <div id="by-category">Loading...</div>
        </div>
        <div class="card"><div class="card-hd"><div class="dot" style="background:#aa66ff"></div> ACTIONS</div>
          <div style="padding:1rem 0">
            <button class="btn btn-sm" onclick="syncCal()" style="margin-bottom:.8rem">SYNC FROM BUSINESS DATA</button>
            <div id="sync-result" style="font-size:.65rem;color:#555;margin-top:.5rem"></div>
          </div>
          <div style="border-top:1px solid #111;padding-top:1rem;margin-top:1rem">
            <div style="font-size:.65rem;color:#555;margin-bottom:.8rem;letter-spacing:.1em;font-family:'Bebas Neue',sans-serif">ADD EVENT</div>
            <input class="inp" id="ev-title" placeholder="Event title" style="margin-bottom:.5rem">
            <div style="display:flex;gap:.5rem;margin-bottom:.5rem">
              <select class="inp" id="ev-cat" style="flex:1"><option value="commercial">Commercial</option><option value="operations">Operations</option><option value="policy">Policy</option><option value="evidence">Evidence</option><option value="executive">Executive</option></select>
              <input class="inp" id="ev-date" type="date" style="flex:1">
            </div>
            <input class="inp" id="ev-notes" placeholder="Notes (optional)" style="margin-bottom:.5rem">
            <button class="btn btn-sm" onclick="addEvent()">CREATE</button>
            <div id="add-result" style="font-size:.6rem;color:#555;margin-top:.3rem"></div>
          </div>
        </div>
      </div>

      ${FT("CALENDAR")}
    </div>
    <script>
      function $(id){return document.getElementById(id)}
      function catBadge(c){return '<span class="cal-cat '+c+'">'+c.toUpperCase()+'</span>'}
      function statusBadge(s){return '<span class="cal-status '+s+'">'+s.toUpperCase()+'</span>'}
      function calItem(ev){
        var t=new Date(ev.starts_at);
        var time=t.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
        return '<div class="cal-item">'+(ev.action_url?'<a href="'+ev.action_url+'" class="cal-title" style="color:#ccc;text-decoration:none">':'<span class="cal-title">')+ev.title+(ev.action_url?'</a>':'</span>')+catBadge(ev.category)+statusBadge(ev.status)+'<span class="cal-time">'+time+'</span></div>';
      }

      async function loadCal(){try{
        var[sum,today,week,overdue]=await Promise.all([
          fetch('/api/calendar/summary').then(function(r){return r.json()}),
          fetch('/api/calendar/today').then(function(r){return r.json()}),
          fetch('/api/calendar/week').then(function(r){return r.json()}),
          fetch('/api/calendar/overdue').then(function(r){return r.json()}),
        ]);

        $('cal-today').textContent=sum.today||0;
        $('cal-week').textContent=sum.thisWeek||0;
        $('cal-overdue').textContent=sum.overdue||0;
        $('cal-upcoming').textContent=sum.upcoming||0;

        if(overdue.events?.length){
          $('overdue-list').innerHTML=overdue.events.map(calItem).join('');
        }else{$('overdue-list').innerHTML='<div style="padding:2rem;text-align:center;color:#00ff88;font-size:.7rem;font-family:Bebas Neue,sans-serif;letter-spacing:.1em">NO OVERDUE ITEMS — ON TRACK</div>'}

        if(today.events?.length){
          $('today-list').innerHTML=today.events.map(calItem).join('');
        }else{$('today-list').innerHTML='<div style="padding:2rem;text-align:center;color:#333;font-size:.7rem">No events today</div>'}

        if(week.days){
          var html='';
          for(var day in week.days){
            html+='<div class="cal-day"><div class="cal-day-hd">'+day+'</div>';
            if(week.days[day].length){html+=week.days[day].map(calItem).join('')}
            else{html+='<div style="padding:.5rem 1rem;font-size:.6rem;color:#1a1a1a">—</div>'}
            html+='</div>';
          }
          $('week-view').innerHTML=html;
        }

        if(sum.byCategory){
          var cats=sum.byCategory;
          var html2='';
          var colors={commercial:'#00ff88',operations:'#00ccff',policy:'#ff2266',evidence:'#ff6600',executive:'#aa66ff'};
          for(var cat in colors){
            var count=cats[cat]||0;
            html2+='<div class="row"><span class="l" style="color:'+colors[cat]+'">'+cat.toUpperCase()+'</span><span class="v">'+count+'</span></div>';
          }
          $('by-category').innerHTML=html2;
        }
      }catch(e){console.error('Cal load error',e)}}

      async function syncCal(){
        $('sync-result').textContent='Syncing...';
        try{
          var r=await fetch('/api/calendar/sync',{method:'POST'}).then(function(r){return r.json()});
          $('sync-result').innerHTML='<span style="color:#00ff88">Synced '+r.synced+' events, marked '+r.markedOverdue+' overdue</span>';
          loadCal();
        }catch(e){$('sync-result').innerHTML='<span style="color:#ff2244">Sync failed</span>'}
      }

      async function addEvent(){
        var title=$('ev-title').value;
        if(!title){$('add-result').textContent='Title required';return}
        var date=$('ev-date').value;
        var startsAt=date?new Date(date+'T09:00:00').toISOString():new Date().toISOString();
        try{
          await fetch('/api/calendar/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title,category:$('ev-cat').value,startsAt:startsAt,notes:$('ev-notes').value||null})});
          $('ev-title').value='';$('ev-notes').value='';
          $('add-result').innerHTML='<span style="color:#00ff88">Created</span>';
          loadCal();
        }catch(e){$('add-result').innerHTML='<span style="color:#ff2244">Failed</span>'}
      }

      loadCal();setInterval(loadCal,15000);
    <\/script>
    ${ROOM_BG}
    </body></html>`);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // REVENUE (was Commercial) — Data-driven from /api/commercial/*
  // ═══════════════════════════════════════════════════════════════════════
  server.get("/rooms/commercial", async (_req, reply) => reply.redirect("/rooms/revenue"));
  server.get("/rooms/revenue", async (_req, reply) => {
    return reply.type("text/html").send(`<!DOCTYPE html><html lang="en"><head><title>Revenue — VYRDX</title>${H}</head><body>
    <canvas id="bg"></canvas>
    <div class="page">
      ${TNAV("revenue")}
      <div class="nav"><div class="nav-title" style="color:#00ff88">REVENUE</div><div class="nav-badge">VYRDON ENFORCED</div></div>
      <div class="enforce" id="rev-status">EXECUTION ECONOMICS · EVERY SEAL RECORDED · EVERY ACTION PRICED · NO EXCEPTIONS</div>
      <div id="rev-content">
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-val" style="color:#00ff88" id="mrr">—</div><div class="kpi-label">MRR</div><style>.kpi:nth-child(1)::after{background:#00ff88}</style></div>
          <div class="kpi"><div class="kpi-val" style="color:#00ff88" id="arr">—</div><div class="kpi-label">ARR</div><style>.kpi:nth-child(2)::after{background:#00ff88}</style></div>
          <div class="kpi"><div class="kpi-val" style="color:#00ccff" id="customers">—</div><div class="kpi-label">Active Customers</div><style>.kpi:nth-child(3)::after{background:#00ccff}</style></div>
          <div class="kpi"><div class="kpi-val" style="color:#ff6600" id="executions">—</div><div class="kpi-label">Total Executions</div><style>.kpi:nth-child(4)::after{background:#ff6600}</style></div>
          <div class="kpi"><div class="kpi-val" style="color:#aa66ff" id="success-rate">—</div><div class="kpi-label">Success Rate</div><style>.kpi:nth-child(5)::after{background:#aa66ff}</style></div>
          <div class="kpi"><div class="kpi-val" style="color:#ff2266" id="unpaid">—</div><div class="kpi-label">Unpaid Balance</div><style>.kpi:nth-child(6)::after{background:#ff2266}</style></div>
        </div>
        <div class="grid g2">
          <div class="card"><div class="card-hd"><div class="dot" style="background:#00ff88"></div> CUSTOMER ACCOUNTS</div>
            <div id="customer-list">Loading...</div>
          </div>
          <div class="card"><div class="card-hd"><div class="dot" style="background:#00ccff"></div> REVENUE BREAKDOWN</div>
            <div id="revenue-detail">Loading...</div>
          </div>
        </div>
        <div class="grid g2">
          <div class="card"><div class="card-hd"><div class="dot" style="background:#ff6600"></div> INVOICES</div>
            <div id="invoices" style="max-height:400px;overflow-y:auto">Loading...</div>
          </div>
          <div class="card"><div class="card-hd"><div class="dot" style="background:#aa66ff"></div> RECEIPTS</div>
            <div id="receipts" style="max-height:400px;overflow-y:auto">Loading...</div>
          </div>
        </div>
        <div class="grid g2">
          <div class="card"><div class="card-hd"><div class="dot" style="background:#00ff88"></div> STAMPS</div>
            <div id="stamps" style="max-height:400px;overflow-y:auto">Loading...</div>
          </div>
          <div class="card"><div class="card-hd"><div class="dot" style="background:#ff2266"></div> FAILURES</div>
            <div id="failures" style="max-height:400px;overflow-y:auto">Loading...</div>
          </div>
        </div>
        <div class="card"><div class="card-hd"><div class="dot" style="background:#00ff88"></div> REVENUE METRICS</div>
          <div id="metrics" class="grid g3">Loading...</div>
        </div>
      </div>
      ${FT("REVENUE")}
    </div>
    <script>
      function $(id){return document.getElementById(id)}
      function fmt(c){return '$'+(parseInt(c||'0')/100).toFixed(2)}
      function fmtD(c){return '$'+parseFloat(c||'0').toFixed(2)}
      function row(l,v,c){return '<div class="row"><span class="l">'+l+'</span><span class="v"'+(c?' style="color:'+c+'"':'')+'>'+v+'</span></div>'}
      function badge(s){var c=s==='active'?'#00ff88':s==='paused'?'#ffaa00':'#ff2266';return '<span style="color:'+c+';font-family:Bebas Neue,sans-serif;letter-spacing:.1em">'+s.toUpperCase()+'</span>'}

      function renderPreLaunch(){
        $('rev-status').innerHTML='PRE-LAUNCH · BILLING INFRASTRUCTURE READY · AWAITING FIRST CUSTOMER';
        $('rev-status').style.color='#ffaa00';
        $('rev-status').style.borderColor='rgba(255,170,0,.15)';
        $('rev-content').innerHTML=
          '<div class="kpi-grid">'+
            '<div class="kpi"><div class="kpi-val" style="color:#ffaa00;font-size:clamp(1.2rem,3vw,1.8rem)">PRE-LAUNCH</div><div class="kpi-label">SYSTEM STATUS</div><style>.kpi:nth-child(1)::after{background:#ffaa00}</style></div>'+
            '<div class="kpi"><div class="kpi-val" style="color:#00ff88">0</div><div class="kpi-label">CUSTOMERS</div><style>.kpi:nth-child(2)::after{background:#00ff88}</style></div>'+
            '<div class="kpi"><div class="kpi-val" style="color:#00ff88">READY</div><div class="kpi-label">BILLING PIPELINE</div><style>.kpi:nth-child(3)::after{background:#00ff88}</style></div>'+
            '<div class="kpi"><div class="kpi-val" style="color:#00ff88">READY</div><div class="kpi-label">EVIDENCE CHAIN</div><style>.kpi:nth-child(4)::after{background:#00ff88}</style></div>'+
          '</div>'+
          '<div class="grid g2">'+
            '<div class="card"><div class="card-hd"><div class="dot" style="background:#00ff88"></div> INFRASTRUCTURE READINESS</div>'+
              row('Customer Pipeline','READY','#00ff88')+
              row('Contract Management','READY','#00ff88')+
              row('Invoice Generation','READY','#00ff88')+
              row('Receipt Issuance','READY','#00ff88')+
              row('Stamp Verification','READY','#00ff88')+
              row('Evidence Linkage','READY','#00ff88')+
              row('Failure Tracking','READY','#00ff88')+
              row('Metrics Pipeline','READY','#00ff88')+
            '</div>'+
            '<div class="card"><div class="card-hd"><div class="dot" style="background:#ffaa00"></div> AVAILABLE PLANS</div>'+
              row('Core','Entry-level execution plan')+
              row('Execution','Mid-tier with higher limits')+
              row('Verified','Full verification + evidence')+
              row('Enterprise','Custom terms + dedicated')+
              '<div style="border-top:1px solid #111;padding-top:1rem;margin-top:1rem">'+
                row('Billing Model','Execution-backed pricing')+
                row('Evidence','Every action hashed and chained')+
                row('Currency','USD')+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div class="card"><div class="card-hd"><div class="dot" style="background:#00ccff"></div> WHAT THIS ROOM WILL SHOW</div>'+
            '<div class="grid g3">'+
              '<div>'+row('MRR / ARR','Real revenue from real customers')+row('Customer Accounts','Verified onboarded accounts')+row('Invoices','Execution-backed billing periods')+'</div>'+
              '<div>'+row('Receipts','Evidence-linked payment proofs')+row('Stamps','Execution verification seals')+row('Failures','Tracked and linked to incidents')+'</div>'+
              '<div>'+row('Collection Rate','Paid vs outstanding')+row('Success Rate','Execution success metrics')+row('ARPA','Average revenue per account')+'</div>'+
            '</div>'+
          '</div>';
      }

      async function load(){try{
        var[sum,cust,inv,rec,stm,fail,met]=await Promise.all([
          fetch('/api/commercial/summary').then(function(r){return r.json()}),
          fetch('/api/commercial/customers').then(function(r){return r.json()}),
          fetch('/api/commercial/invoices').then(function(r){return r.json()}),
          fetch('/api/commercial/receipts').then(function(r){return r.json()}),
          fetch('/api/commercial/stamps').then(function(r){return r.json()}),
          fetch('/api/commercial/failures').then(function(r){return r.json()}),
          fetch('/api/commercial/metrics').then(function(r){return r.json()}),
        ]);

        if(!sum.customers?.total || sum.customers.total===0){
          renderPreLaunch();
          return;
        }

        $('mrr').textContent=fmtD(sum.revenue?.mrr);
        $('arr').textContent=fmtD(sum.revenue?.arr);
        $('customers').textContent=sum.customers?.active||0;
        $('executions').textContent=sum.usage?.totalExecutions||0;
        $('success-rate').textContent=(sum.usage?.successRate||0)+'%';
        $('unpaid').textContent=fmtD(sum.revenue?.unpaid);

        if(cust.customers?.length){
          $('customer-list').innerHTML=cust.customers.map(function(c){return '<div class="si"><div class="si-head"><span class="si-id">'+c.company_name+'</span><span class="si-time">'+badge(c.status)+'</span></div><div class="si-body">Plan: '+c.plan.toUpperCase()+' · '+(c.billing_email||'no email')+'</div><div class="si-hash">ID: '+c.id+'</div></div>'}).join('');
        }else{$('customer-list').innerHTML='<div style="padding:2rem;text-align:center;color:#222;font-size:.7rem">No customers yet</div>'}

        $('revenue-detail').innerHTML=
          row('MRR',fmtD(sum.revenue?.mrr),'#00ff88')+
          row('ARR',fmtD(sum.revenue?.arr),'#00ff88')+
          row('Paid Revenue',fmtD(sum.revenue?.paid))+
          row('Unpaid Balance',fmtD(sum.revenue?.unpaid),'#ffaa00')+
          row('Overdue',fmtD(sum.revenue?.overdue),'#ff2266')+
          row('Active Customers',sum.customers?.active||0)+
          row('Churned',sum.customers?.churned||0,'#ff2266');

        if(inv.invoices?.length){
          $('invoices').innerHTML='<table><thead><tr><th>CUSTOMER</th><th>PERIOD</th><th>TOTAL</th><th>STATUS</th></tr></thead><tbody>'+inv.invoices.map(function(i){return '<tr><td>'+i.company_name+'</td><td style="font-size:.6rem">'+i.period_start+' → '+i.period_end+'</td><td>'+fmt(i.total_cents)+'</td><td>'+badge(i.status)+'</td></tr>'}).join('')+'</tbody></table>';
        }else{$('invoices').innerHTML='<div style="padding:2rem;text-align:center;color:#222;font-size:.7rem">No invoices</div>'}

        if(rec.receipts?.length){
          $('receipts').innerHTML=rec.receipts.map(function(r){return '<div class="si"><div class="si-head"><span class="si-id">'+r.company_name+'</span><span class="si-time">'+fmt(r.amount_cents)+' '+r.currency+'</span></div><div class="si-hash">Evidence: '+r.evidence_hash.slice(0,32)+'...</div><div class="si-body" style="font-size:.55rem">Issued: '+new Date(r.issued_at).toLocaleString()+'</div></div>'}).join('');
        }else{$('receipts').innerHTML='<div style="padding:2rem;text-align:center;color:#222;font-size:.7rem">No receipts generated</div>'}

        if(stm.stamps?.length){
          $('stamps').innerHTML=stm.stamps.map(function(s){var sc=s.state==='executed'?'#00ff88':s.state==='partial'?'#ffaa00':'#ff2266';return '<div class="si"><div class="si-head"><span class="si-id">'+s.company_name+'</span><span class="si-time" style="color:'+sc+'">'+s.state.toUpperCase()+'</span></div><div class="si-hash">Hash: '+s.evidence_hash.slice(0,32)+'...</div></div>'}).join('');
        }else{$('stamps').innerHTML='<div style="padding:2rem;text-align:center;color:#222;font-size:.7rem">No stamps issued</div>'}

        if(fail.failures?.length){
          $('failures').innerHTML=fail.failures.map(function(f){return '<div class="si"><div class="si-head"><span class="si-id" style="color:#ff2266">'+f.job_type+'</span><span class="si-time">'+(f.company_name||'system')+'</span></div><div class="si-body">Status: '+f.status+' · '+(f.detail?.reason||'no detail')+'</div></div>'}).join('');
        }else{$('failures').innerHTML='<div style="padding:2rem;text-align:center;color:#00ff88;font-size:.7rem">No failures recorded</div>'}

        if(met.revenue){
          var r2=met.revenue,u=met.usage,q=met.quality;
          $('metrics').innerHTML=
            '<div>'+row('MRR',fmtD(r2.mrr),'#00ff88')+row('ARR',fmtD(r2.arr),'#00ff88')+row('ARPA',fmtD(r2.arpa))+row('Customers',r2.customer_count)+row('Overdue Invoices',r2.overdue_count)+row('Collection Rate',r2.collection_rate+'%')+'</div>'+
            '<div>'+row('Executions',u?.total||0)+row('Succeeded',u?.succeeded||0,'#00ff88')+row('Failed',u?.failed||0,'#ff2266')+row('Avg Duration',u?.avg_duration_s+'s')+row('P95 Duration',u?.p95_duration_s+'s')+'</div>'+
            '<div>'+row('Success Rate',(q?.execution_success_rate||0)+'%')+row('Total Receipts',q?.total_receipts||0)+row('Failed Stamps',q?.failed_stamps||0)+row('Evidence-Linked',q?.evidence_linked_receipts||0)+'</div>';
        }
      }catch(e){console.error('Load error',e)}}
      load();setInterval(load,10000);
    <\/script>
    ${ROOM_BG}
    </body></html>`);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // OPERATIONS — Data-driven from /api/operations/*
  // ═══════════════════════════════════════════════════════════════════════
  server.get("/rooms/operations", async (_req, reply) => {
    return reply.type("text/html").send(`<!DOCTYPE html><html lang="en"><head><title>Operations — VYRDX</title>${H}</head><body>
    <canvas id="bg"></canvas>
    <div class="page">
      ${TNAV("operations")}
      <div class="nav"><div class="nav-title" style="color:#00ccff">OPERATIONS</div><div class="nav-badge">RUNTIME CONTROL</div></div>
      <div class="enforce">SYSTEM CONTROL · ALL SERVICES MONITORED · ALL LAYERS ENFORCED · ZERO BLIND SPOTS</div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-val" style="color:#00ccff" id="uptime">—</div><div class="kpi-label">Uptime</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#00ff88" id="svc-healthy">—</div><div class="kpi-label">Healthy Services</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#ff6600" id="mem">—</div><div class="kpi-label">Heap (MB)</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#ff2266" id="incidents-open">—</div><div class="kpi-label">Open Incidents</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#aa66ff" id="jobs-queued">—</div><div class="kpi-label">Queued Jobs</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#ffaa00" id="deploys">—</div><div class="kpi-label">Deploys</div></div>
      </div>

      <div class="grid g2">
        <div class="card"><div class="card-hd"><div class="dot" style="background:#00ff88"></div> SERVICE HEALTH</div>
          <div id="services">Loading...</div>
        </div>
        <div class="card"><div class="card-hd"><div class="dot" style="background:#00ccff"></div> RUNTIME</div>
          <div id="runtime">Loading...</div>
        </div>
      </div>

      <div class="grid g2">
        <div class="card"><div class="card-hd"><div class="dot" style="background:#ff6600"></div> DEPLOYMENT HISTORY</div>
          <div id="deploy-list" style="max-height:400px;overflow-y:auto">Loading...</div>
        </div>
        <div class="card"><div class="card-hd"><div class="dot" style="background:#aa66ff"></div> DEPENDENCIES</div>
          <div id="deps">Loading...</div>
        </div>
      </div>

      <div class="grid g2">
        <div class="card"><div class="card-hd"><div class="dot" style="background:#ff2266"></div> INCIDENT BOARD</div>
          <div id="incident-list" style="max-height:400px;overflow-y:auto">Loading...</div>
        </div>
        <div class="card"><div class="card-hd"><div class="dot" style="background:#ffaa00"></div> JOB QUEUE</div>
          <div id="job-list" style="max-height:400px;overflow-y:auto">Loading...</div>
        </div>
      </div>

      <div class="card"><div class="card-hd"><div class="dot" style="background:#00ccff"></div> OPERATIONS METRICS</div>
        <div id="metrics" class="grid g3">Loading...</div>
      </div>
      ${FT("OPERATIONS")}
    </div>
    <script>
      function $(id){return document.getElementById(id)}
      function row(l,v,c){return '<div class="row"><span class="l">'+l+'</span><span class="v"'+(c?' style="color:'+c+'"':'')+'>'+v+'</span></div>'}
      function badge(s){var m={'healthy':'#00ff88','degraded':'#ffaa00','down':'#ff2266','open':'#ff2266','mitigating':'#ffaa00','resolved':'#00ff88','succeeded':'#00ff88','failed':'#ff2266','started':'#00ccff','rolled_back':'#ff6600','queued':'#aa66ff','running':'#00ccff','dead':'#ff2266','retrying':'#ffaa00'};return '<span style="color:'+(m[s]||'#888')+';font-family:Bebas Neue,sans-serif;letter-spacing:.1em">'+s.toUpperCase()+'</span>'}
      function fmtUp(s){var h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h+'h '+m+'m'}

      async function load(){try{
        var[sum,svcs,runtime,deploys,deps,incidents,jobs,met]=await Promise.all([
          fetch('/api/operations/summary').then(function(r){return r.json()}),
          fetch('/api/operations/services').then(function(r){return r.json()}),
          fetch('/api/operations/runtime').then(function(r){return r.json()}),
          fetch('/api/operations/deployments').then(function(r){return r.json()}),
          fetch('/api/operations/dependencies').then(function(r){return r.json()}),
          fetch('/api/operations/incidents').then(function(r){return r.json()}),
          fetch('/api/operations/jobs').then(function(r){return r.json()}),
          fetch('/api/operations/metrics').then(function(r){return r.json()}),
        ]);

        $('uptime').textContent=fmtUp(sum.uptime||0);
        $('svc-healthy').textContent=sum.services?.healthy||0;
        $('mem').textContent=sum.memory?.heapUsedMb||0;
        $('incidents-open').textContent=sum.incidents?.open||0;
        $('jobs-queued').textContent=sum.jobs?.queued||0;
        $('deploys').textContent=met.deploys?.total||0;

        if(svcs.services?.length){
          $('services').innerHTML=svcs.services.map(function(s){return row(s.service_name,badge(s.status))}).join('');
        }else{$('services').innerHTML=row('No services registered','—','#555')}

        $('runtime').innerHTML=
          row('Node',runtime.nodeVersion||'—')+
          row('PID',runtime.pid)+
          row('Heap',runtime.memory?.heapUsedMb+'MB / '+runtime.memory?.heapTotalMb+'MB')+
          row('RSS',runtime.memory?.rssMb+'MB')+
          row('CPU User',runtime.cpu?.userMs+'ms')+
          row('CPU System',runtime.cpu?.systemMs+'ms')+
          row('Postgres',badge(runtime.dependencies?.postgres||'disconnected'))+
          row('Uptime',fmtUp(runtime.uptime||0));

        if(deploys.deployments?.length){
          $('deploy-list').innerHTML=deploys.deployments.map(function(d){return '<div class="si"><div class="si-head"><span class="si-id">'+d.release_id+'</span><span class="si-time">'+badge(d.status)+'</span></div><div class="si-body">Commit: '+d.git_commit.slice(0,8)+' · '+(d.operator||'system')+' · '+d.environment+'</div><div class="si-hash" style="font-size:.55rem">'+new Date(d.created_at).toLocaleString()+'</div></div>'}).join('');
        }else{$('deploy-list').innerHTML='<div style="padding:2rem;text-align:center;color:#222;font-size:.7rem">No deployments recorded</div>'}

        $('deps').innerHTML=
          row('PostgreSQL',badge(deps.postgres?.status||'down'))+
          row('ConsoleLab (ASUS)',badge(deps.consolelab?.status||'unreachable'));

        if(incidents.incidents?.length){
          $('incident-list').innerHTML=incidents.incidents.map(function(i){var sc=i.severity==='critical'?'#ff2266':i.severity==='high'?'#ff6600':i.severity==='medium'?'#ffaa00':'#888';return '<div class="si"><div class="si-head"><span class="si-id" style="color:'+sc+'">'+i.severity.toUpperCase()+'</span><span class="si-time">'+badge(i.status)+'</span></div><div class="si-body">'+i.title+'</div><div class="si-hash">'+(i.owner?'Owner: '+i.owner+' · ':'')+'Opened: '+new Date(i.opened_at).toLocaleString()+'</div></div>'}).join('');
        }else{$('incident-list').innerHTML='<div style="padding:2rem;text-align:center;color:#00ff88;font-size:.7rem">No incidents — all clear</div>'}

        if(jobs.jobs?.length){
          $('job-list').innerHTML='<table><thead><tr><th>TYPE</th><th>STATUS</th><th>STARTED</th></tr></thead><tbody>'+jobs.jobs.slice(0,30).map(function(j){return '<tr><td>'+j.job_type+'</td><td>'+badge(j.status)+'</td><td style="font-size:.6rem">'+(j.started_at?new Date(j.started_at).toLocaleString():'—')+'</td></tr>'}).join('')+'</tbody></table>';
        }else{$('job-list').innerHTML='<div style="padding:2rem;text-align:center;color:#222;font-size:.7rem">No jobs</div>'}

        if(met.deploys){
          $('metrics').innerHTML=
            '<div>'+row('Total Deploys',met.deploys.total)+row('Succeeded',met.deploys.succeeded,'#00ff88')+row('Failed',met.deploys.failed,'#ff2266')+row('Rolled Back',met.deploys.rolled_back,'#ff6600')+row('Mean Duration',met.deploys.mean_deploy_duration_s+'s')+'</div>'+
            '<div>'+row('Total Incidents',met.incidents?.total||0)+row('Open',met.incidents?.open||0,'#ff2266')+row('Resolved',met.incidents?.resolved||0,'#00ff88')+row('MTTR',(met.incidents?.mttr_s||0)+'s')+'</div>'+
            '<div>'+row('Total Jobs',met.jobs?.total||0)+row('Queued',met.jobs?.queued||0)+row('Dead Letter',met.jobs?.dead||0,'#ff2266')+row('Failure Rate',(met.jobs?.failure_rate||0)+'%')+'</div>';
        }
      }catch(e){console.error('Load error',e)}}
      load();setInterval(load,6000);
    <\/script>
    ${ROOM_BG}
    </body></html>`);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // EVIDENCE / AUDIT — Data-driven from /api/evidence/*
  // ═══════════════════════════════════════════════════════════════════════
  server.get("/rooms/evidence", async (_req, reply) => {
    return reply.type("text/html").send(`<!DOCTYPE html><html lang="en"><head><title>Audit — VYRDX</title>${H}</head><body>
    <canvas id="bg"></canvas>
    <div class="page">
      ${TNAV("evidence")}
      <div class="nav"><div class="nav-title" style="color:#ff6600">AUDIT</div><div class="nav-badge">EVIDENCE CHAIN</div></div>
      <div class="enforce">IMMUTABLE RECORD · EVERY HASH CHAINED · EVERY PROOF VERIFIABLE · EXECUTION WITHOUT EVIDENCE IS VOID</div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-val" style="color:#ff6600" id="total">—</div><div class="kpi-label">Total Events</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#00ff88" id="chain-status">—</div><div class="kpi-label">Chain Status</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#00ccff" id="signed-pct">—</div><div class="kpi-label">Signed %</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#aa66ff" id="verified-pct">—</div><div class="kpi-label">Verified %</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#00ff88" id="receipt-linked">—</div><div class="kpi-label">Receipt Linked</div></div>
        <div class="kpi"><div class="kpi-val" style="color:#ffaa00" id="customers-covered">—</div><div class="kpi-label">Customers Covered</div></div>
      </div>

      <div class="card"><div class="card-hd"><div class="dot" style="background:#ff6600"></div> CHAIN HEAD</div>
        <div id="chain-head">Loading...</div>
      </div>

      <div class="card" style="margin-bottom:2rem"><div class="card-hd"><div class="dot" style="background:#ff6600"></div> CHAIN VERIFICATION</div>
        <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center">
          <button class="btn" onclick="verifyChain()">VERIFY CHAIN</button>
          <span id="chain-result" style="font-size:.75rem"></span>
        </div>
      </div>

      <div class="card" style="margin-bottom:2rem"><div class="card-hd"><div class="dot" style="background:#00ccff"></div> EVENT FILTERS</div>
        <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem">
          <select class="inp" id="filter-room" style="flex:1;min-width:120px"><option value="">All Rooms</option><option value="commercial">Commercial</option><option value="operations">Operations</option><option value="evidence">Evidence</option></select>
          <select class="inp" id="filter-type" style="flex:1;min-width:120px"><option value="">All Types</option><option value="seal">Seal</option><option value="sign">Sign</option><option value="attest">Attest</option><option value="receipt">Receipt</option><option value="stamp">Stamp</option><option value="execution">Execution</option></select>
          <button class="btn" onclick="loadEvents()">FILTER</button>
        </div>
      </div>

      <div class="card"><div class="card-hd"><div class="dot" style="background:#ff6600"></div> EVIDENCE TIMELINE</div>
        <div id="events" style="max-height:600px;overflow-y:auto">Loading...</div>
      </div>

      <div class="card"><div class="card-hd"><div class="dot" style="background:#00ff88"></div> EVIDENCE METRICS</div>
        <div id="metrics" class="grid g3">Loading...</div>
      </div>
      ${FT("AUDIT")}
    </div>
    <script>
      function $(id){return document.getElementById(id)}
      function row(l,v,c){return '<div class="row"><span class="l">'+l+'</span><span class="v"'+(c?' style="color:'+c+'"':'')+'>'+v+'</span></div>'}

      async function loadSummary(){try{
        var sum=await fetch('/api/evidence/summary').then(function(r){return r.json()});
        $('total').textContent=sum.total||0;
        $('signed-pct').textContent=(sum.signedPct||0)+'%';
        $('verified-pct').textContent=(sum.verifiedPct||0)+'%';
        $('receipt-linked').textContent=sum.receiptLinked||0;
        $('customers-covered').textContent=sum.customersCovered||0;
        if(sum.chainHead){
          $('chain-head').innerHTML=
            row('Head Hash',sum.chainHead.hash,'#ff6600')+
            row('Chain Hash',sum.chainHead.chainHash)+
            row('Recorded',new Date(sum.chainHead.at).toLocaleString());
        }else{$('chain-head').innerHTML=row('Chain','Empty — no events recorded','#555')}
      }catch(e){console.error(e)}}

      async function verifyChain(){
        $('chain-result').innerHTML='<span style="color:#555">Verifying chain...</span>';
        try{
          var r=await fetch('/api/evidence/chain/verify').then(function(r){return r.json()});
          if(r.verified){
            $('chain-status').textContent='INTACT';
            $('chain-status').style.color='#00ff88';
            $('chain-result').innerHTML='<span style="color:#00ff88;font-family:Bebas Neue,sans-serif;font-size:1.5rem;letter-spacing:.1em">✓ CHAIN VERIFIED · '+r.chainLength+' EVENTS · INTACT</span>';
          }else{
            $('chain-status').textContent='BROKEN';
            $('chain-status').style.color='#ff2266';
            $('chain-result').innerHTML='<span style="color:#ff2266;font-family:Bebas Neue,sans-serif;font-size:1.5rem;letter-spacing:.1em">✗ CHAIN BROKEN AT EVENT '+r.brokenAt+'</span>';
          }
        }catch(e){$('chain-result').innerHTML='<span style="color:#ff2266">Verification failed</span>'}
      }

      async function loadEvents(){try{
        var room=$('filter-room').value;
        var type=$('filter-type').value;
        var qs='?limit=100';
        if(room)qs+='&room='+room;
        if(type)qs+='&type='+type;
        var r=await fetch('/api/evidence/events'+qs).then(function(r){return r.json()});
        if(r.events?.length){
          $('events').innerHTML=r.events.map(function(e){
            var sc=e.signed?'#00ff88':'#555';
            var vc=e.verified?'#00ff88':'#555';
            return '<div class="si"><div class="si-head"><span class="si-id" style="color:#ff6600">'+e.event_type.toUpperCase()+'</span><span class="si-time">'+e.room+' / '+e.service+'</span></div>'+
              '<div class="si-body">'+
              '<span style="color:'+sc+';margin-right:8px">●</span>signed '+
              '<span style="color:'+vc+';margin-right:8px;margin-left:12px">●</span>verified'+
              (e.customer_id?' · customer: '+e.customer_id.slice(0,8)+'...':'')+
              (e.receipt_id?' · <a href="/api/evidence/receipts/'+e.receipt_id+'" class="pl">receipt</a>':'')+
              (e.stamp_id?' · <a href="/api/evidence/stamps/'+e.stamp_id+'" class="pl">stamp</a>':'')+
              '</div>'+
              '<div class="si-hash">Hash: '+e.event_hash.slice(0,40)+'... · Prev: '+e.prev_hash.slice(0,16)+'...</div>'+
              '<div class="si-hash" style="color:#1a1a1a">Payload: '+e.payload_digest.slice(0,32)+'... · '+new Date(e.created_at).toLocaleString()+'</div></div>';
          }).join('');
        }else{$('events').innerHTML='<div style="padding:4rem;text-align:center"><div style="font-size:4rem;color:#111;margin-bottom:1rem">◇</div><div style="font-family:Bebas Neue,sans-serif;font-size:1.3rem;letter-spacing:.1em;color:#222">NO EVIDENCE RECORDED</div><div style="font-size:.6rem;color:#1a1a1a;margin-top:.5rem">Events will appear as the system executes actions</div></div>'}
      }catch(e){console.error(e)}}

      async function load(){
        await loadSummary();
        await loadEvents();
        var sum=await fetch('/api/evidence/summary').then(function(r){return r.json()}).catch(function(){return null});
        if(sum){
          $('metrics').innerHTML=
            '<div>'+row('Total Events',sum.total)+row('Event Types',sum.eventTypes)+row('Customers Covered',sum.customersCovered)+'</div>'+
            '<div>'+row('Signed',sum.signed,'#00ff88')+row('Verified',sum.verified,'#00ff88')+row('Signed %',sum.signedPct+'%')+row('Verified %',sum.verifiedPct+'%')+'</div>'+
            '<div>'+row('Receipt Linked',sum.receiptLinked)+row('Stamp Linked',sum.stampLinked)+'</div>';
        }
      }
      load();setInterval(load,8000);
    <\/script>
    ${ROOM_BG}
    </body></html>`);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // CAMPS / ABOUT — The Seven Laws, Architecture, Contact
  // ═══════════════════════════════════════════════════════════════════════
  server.get("/rooms/camps", async (_req, reply) => {
    return reply.type("text/html").send(`<!DOCTYPE html><html lang="en"><head><title>About — VYRDX</title>${H}</head><body>
    <canvas id="bg"></canvas>
    <div class="page">
      ${TNAV("camps")}
      <div class="nav"><div class="nav-title" style="color:#aa66ff">ABOUT</div><div class="nav-badge">PROTOCOL</div></div>
      <div class="enforce">THE PROTOCOL IS THE LAW · THE RUNNING CODE IS VYRDON · EVERYTHING ELSE IS COMMENTARY</div>
      <div class="prose">
        <h2>What VYRDON Is</h2>
        <p>VYRDON is a <strong>certified execution protocol</strong>. It seals every business action with a cryptographic hash, timestamps it, chains it to the previous seal, and produces a public proof link that anyone can verify. No trust required.</p>
        <p>The protocol operates on <strong>Arbitrum One (Layer 2)</strong>, governed by a <strong>Gnosis Safe multisig</strong> with no single point of control. Smart contracts are immutable by design. There is no admin key. There is no backdoor. There is no override.</p>
        <h2>The Seven Laws</h2>
        <p>These laws are immutable. They cannot be modified, suspended, or overridden.</p>
        <ul>
          <li><strong>Law I — Evidence:</strong> Execution without evidence is void.</li>
          <li><strong>Law II — Identity:</strong> Agents are identified, not anonymous. Every agent has a badge.</li>
          <li><strong>Law III — Immutability:</strong> The seal cannot be retroactively modified.</li>
          <li><strong>Law IV — Separation:</strong> AI Room and Runtime are separated by architecture.</li>
          <li><strong>Law V — Visibility:</strong> Security operations are visible. No cover. Every scan is badged and sealed.</li>
          <li><strong>Law VI — Authority:</strong> Financial operations require multi-signature.</li>
          <li><strong>Law VII — Sovereignty:</strong> The protocol is the law. The running code is VYRDON. Everything else is commentary.</li>
        </ul>
        <h2>Architecture</h2>
        <p>VYRDON operates across <strong>three planes</strong> connected via encrypted Tailscale mesh:</p>
        <ul>
          <li><strong>Execution Plane</strong> — VXSTATION on DigitalOcean, behind Cloudflare Zero Trust. Seals actions, serves proofs, monitors operations.</li>
          <li><strong>Authority Plane</strong> — ConsoLab on dedicated hardware. Signs attestations, manages governance, issues certificates.</li>
          <li><strong>Intelligence Plane</strong> — AI Room on separate domain (vyrden.com). 7 agents analyze, review, and recommend. They never execute.</li>
        </ul>
        <h2>Domains</h2>
        <ul>
          <li><strong>vyrdon.com</strong> — Protocol public face</li>
          <li><strong>vyrdx.vyrdon.com</strong> — Execution platform (you are here)</li>
          <li><strong>consolelab.vyrdon.com</strong> — Authority plane</li>
          <li><strong>vyrden.com</strong> — AI Room (separate product)</li>
        </ul>
        <h2>Contact</h2>
        <p>VYRDON is built and operated by <strong>Tha'er</strong> from Lake Jackson, Texas.</p>
        <p>GitHub: <a href="https://github.com/teee79A" target="_blank">github.com/teee79A</a></p>
        <h2>Intellectual Property</h2>
        <h3>Protocol</h3>
        <p>VYRDON protocol, VYRDX runtime, VXSTATION control plane, and ConsoLab authority system are <strong>proprietary</strong>. All rights reserved. <strong>Patent pending</strong> — Ghost Red Team 86 and VYRDON applications filed.</p>
        <h3>Smart Contracts</h3>
        <p>Six contracts deployed on Arbitrum One (Chain ID 42161). All are <strong>immutable, non-upgradeable</strong>, governed by Gnosis Safe multisig. Source verified on Arbiscan. No EOA admin control exists in the deployed contract set.</p>
        <h3>Trademarks</h3>
        <p><strong>VYRDON</strong>, <strong>VYRDX</strong>, <strong>VXSTATION</strong>, <strong>VYRDON CERTIFIED</strong>, <strong>ASRSATA</strong>, and the VYRDON mark are trademarks. <strong>"VYRDON CERTIFIED TRUE = PASS"</strong> is a registered certification mark.</p>
        <h2>Legal Disclaimer</h2>
        <p>VYRDON CERTIFIED seals are cryptographic evidence records. They prove that an action was recorded at a specific time with a specific hash. They do not constitute legal certification, regulatory approval, or professional endorsement. The seal proves <strong>recording integrity</strong>, not action correctness. Use of VYRDON constitutes acceptance of the protocol's terms.</p>
      </div>
      ${FT("ABOUT")}
    </div>
    ${ROOM_BG}
    </body></html>`);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // POLICY / RISK — Governance, contracts, access
  // ═══════════════════════════════════════════════════════════════════════
  server.get("/rooms/policy", async (_req, reply) => {
    const cr = GOV.contracts.map(c =>
      `<tr><td style="color:#f0f0f0;font-weight:bold">${c.name}</td><td style="font-family:monospace;font-size:.6rem">${c.address}</td><td style="color:${c.status==="SEALED"?"#00ff88":"#ffaa00"};font-family:'Bebas Neue',sans-serif;letter-spacing:.08em">${c.status}</td><td style="color:#555;font-size:.62rem">${c.control}</td></tr>`
    ).join("");
    return reply.type("text/html").send(`<!DOCTYPE html><html lang="en"><head><title>Risk — VYRDX</title>${H}</head><body>
    <canvas id="bg"></canvas>
    <div class="page">
      ${TNAV("policy")}
      <div class="nav"><div class="nav-title" style="color:#ff2266">RISK</div><div class="nav-badge">GOVERNANCE</div></div>
      <div class="enforce">SAFE-GOVERNED · IMMUTABLE CONTRACT CORE · NO EOA ADMIN · NO BACKDOOR · NO OVERRIDE</div>
      <div class="grid g3">
        <div class="card"><div class="card-hd"><div class="dot" style="background:#ff2266"></div> GOVERNANCE</div>
          <div class="row"><span class="l">Chain</span><span class="v">${GOV.chain}</span></div>
          <div class="row"><span class="l">Safe</span><span class="v" style="font-family:monospace;font-size:.55rem">${GOV.safe}</span></div>
          <div class="row"><span class="l">Threshold</span><span class="v" style="color:#00ff88">${GOV.safeThreshold}</span></div>
          <div class="row"><span class="l">Timelock</span><span class="v" style="color:#ff4444">${GOV.timelock}</span></div>
          <div class="row"><span class="l">Guardian</span><span class="v" style="color:#ff4444">${GOV.guardian}</span></div>
        </div>
        <div class="card"><div class="card-hd"><div class="dot" style="background:#00ff88"></div> POSTURE</div>
          <div class="row"><span class="l">Governance</span><span class="v" style="color:#00ff88">SAFE-GOVERNED</span></div>
          <div class="row"><span class="l">EOA Admin</span><span class="v" style="color:#00ff88">NONE</span></div>
          <div class="row"><span class="l">Proxy Admin</span><span class="v" style="color:#00ff88">NONE</span></div>
          <div class="row"><span class="l">Upgrade Path</span><span class="v" style="color:#00ff88">NONE (IMMUTABLE)</span></div>
          <div class="row"><span class="l">Enforcement</span><span class="v" style="color:#00ff88">ACTIVE</span></div>
        </div>
        <div class="card"><div class="card-hd"><div class="dot" style="background:#00ccff"></div> SYSTEM</div>
          <div class="row"><span class="l">Environment</span><span class="v" id="env">—</span></div>
          <div class="row"><span class="l">Runtime</span><span class="v" id="node">—</span></div>
          <div class="row"><span class="l">Port</span><span class="v">7800</span></div>
          <div class="row"><span class="l">Authority</span><span class="v">ConsoLab (ASUS)</span></div>
          <div class="row"><span class="l">Evidence</span><span class="v">Append-only JSONL</span></div>
        </div>
      </div>
      <div class="card"><div class="card-hd"><div class="dot" style="background:#ff2266"></div> SMART CONTRACT REGISTRY — ARBITRUM ONE</div>
        <div style="overflow-x:auto"><table><thead><tr><th>CONTRACT</th><th>ADDRESS</th><th>STATUS</th><th>CONTROL</th></tr></thead><tbody>${cr}</tbody></table></div>
      </div>
      <div class="grid g2">
        <div class="card"><div class="card-hd"><div class="dot" style="background:#aa66ff"></div> ACCESS ENFORCEMENT</div>
          <div class="row"><span class="l">Public Read</span><span class="v">Health · Evidence · Proofs</span></div>
          <div class="row"><span class="l">Public Write</span><span class="v" style="color:#ff4444">DENIED</span></div>
          <div class="row"><span class="l">Seal Creation</span><span class="v">API Key Required</span></div>
          <div class="row"><span class="l">Room Access</span><span class="v">Authenticated</span></div>
          <div class="row"><span class="l">Authority Access</span><span class="v">Service Token Required</span></div>
        </div>
        <div class="card"><div class="card-hd"><div class="dot" style="background:#ff6600"></div> TRUST CHAIN</div>
          <div class="row"><span class="l">Authority</span><span class="v">ASUS → ConsoLab</span></div>
          <div class="row"><span class="l">Attestation</span><span class="v">HMAC-SHA256 signed</span></div>
          <div class="row"><span class="l">Evidence</span><span class="v">Hash-chained · Append-only</span></div>
          <div class="row"><span class="l">Execution</span><span class="v">VYRDX CERTIFIED TRUE = PASS</span></div>
          <div class="row"><span class="l">Verification</span><span class="v">Public proof pages</span></div>
        </div>
      </div>
      ${FT("RISK")}
    </div>
    <script>fetch('/api/build').then(function(r){return r.json()}).then(function(d){document.getElementById('env').textContent=(d.environment||'production').toUpperCase();document.getElementById('node').textContent='Node '+(d.nodeVersion||'—').replace('v','')}).catch(function(){})<\/script>
    ${ROOM_BG}
    </body></html>`);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // MONITOR — Full engine directory + market feed + cloud status
  // Groups: AI Room (86), KITTY Domain, KITTY CEO (20), VYRDX Runtime (7)
  // ═══════════════════════════════════════════════════════════════════════

  // ── Static engine catalogs ───────────────────────────────────────────
  // AI Room: 86 engines on vyrden.com (Droplet). Always shown as static
  //   catalog since the AI Room is a separate service (not queried live here).
  type AIRoomEngine = { id: string; type: string; desc: string; owner: string; agent: string };
  const AI_ROOM_ENGINES: AIRoomEngine[] = [
    // SECURITY — SEC-1 / ABYSSAL
    { id: "engine:blackhat",         type: "security",    desc: "Offensive security simulation",    owner: "SEC-1", agent: "ABYSSAL"  },
    { id: "engine:redhat",           type: "security",    desc: "Defensive posture analysis",        owner: "SEC-1", agent: "ABYSSAL"  },
    { id: "engine:perimeter-scan",   type: "security",    desc: "Network perimeter audit",           owner: "SEC-1", agent: "ABYSSAL"  },
    { id: "engine:injection-audit",  type: "security",    desc: "Prompt injection testing",          owner: "SEC-1", agent: "ABYSSAL"  },
    { id: "engine:key-rotation",     type: "security",    desc: "Secret rotation enforcement",       owner: "SEC-1", agent: "ABYSSAL"  },
    { id: "engine:wallet-allowlist", type: "security",    desc: "Wallet allowlist validation",       owner: "SEC-1", agent: "ABYSSAL"  },
    { id: "engine:threat-model",     type: "security",    desc: "Attack surface mapping",            owner: "SEC-1", agent: "ABYSSAL"  },
    { id: "engine:vuln-scanner",     type: "security",    desc: "Dependency vulnerability scan",     owner: "SEC-1", agent: "ABYSSAL"  },
    { id: "engine:access-control",   type: "security",    desc: "RBAC enforcement",                  owner: "SEC-1", agent: "ABYSSAL"  },
    { id: "engine:incident-response",type: "security",    desc: "Incident triage and response",      owner: "SEC-1", agent: "ABYSSAL"  },
    // FINANCIAL — CFO-1 / LEVERAGE
    { id: "engine:cfo-core",         type: "financial",   desc: "Financial reasoning engine",        owner: "CFO-1", agent: "LEVERAGE" },
    { id: "engine:treasury",         type: "financial",   desc: "Treasury and fund allocation",      owner: "CFO-1", agent: "LEVERAGE" },
    { id: "engine:gas-optimizer",    type: "financial",   desc: "Gas fee optimization",              owner: "CFO-1", agent: "LEVERAGE" },
    { id: "engine:escrow-monitor",   type: "financial",   desc: "EscrowVault state monitoring",      owner: "CFO-1", agent: "LEVERAGE" },
    { id: "engine:burn-rate",        type: "financial",   desc: "Burn rate calculation",             owner: "CFO-1", agent: "LEVERAGE" },
    { id: "engine:runway-projection",type: "financial",   desc: "Runway projection",                 owner: "CFO-1", agent: "LEVERAGE" },
    { id: "engine:invoice-processor",type: "financial",   desc: "Invoice processing",                owner: "CFO-1", agent: "LEVERAGE" },
    { id: "engine:tax-engine",       type: "financial",   desc: "Tax obligation tracking",           owner: "CFO-1", agent: "LEVERAGE" },
    { id: "engine:payroll",          type: "financial",   desc: "Payroll management",                owner: "CFO-1", agent: "LEVERAGE" },
    { id: "engine:financial-reporting",type:"financial",  desc: "Financial report generation",       owner: "CFO-1", agent: "LEVERAGE" },
    // STRATEGY — REV-1 / MAMMON
    { id: "engine:ceo-core",         type: "strategy",    desc: "Strategic reasoning engine",        owner: "REV-1", agent: "MAMMON"   },
    { id: "engine:revenue-model",    type: "strategy",    desc: "Revenue model iteration",           owner: "REV-1", agent: "MAMMON"   },
    { id: "engine:partnership-eval", type: "strategy",    desc: "Partnership scoring",               owner: "REV-1", agent: "MAMMON"   },
    { id: "engine:gtm-strategy",     type: "strategy",    desc: "Go-to-market planning",             owner: "REV-1", agent: "MAMMON"   },
    { id: "engine:investor-relations",type:"strategy",    desc: "Investor communications",           owner: "REV-1", agent: "MAMMON"   },
    { id: "engine:board-reporting",  type: "strategy",    desc: "Board-level reporting",             owner: "REV-1", agent: "MAMMON"   },
    { id: "engine:okr-tracker",      type: "strategy",    desc: "OKR tracking and scoring",          owner: "REV-1", agent: "MAMMON"   },
    { id: "engine:decision-journal", type: "strategy",    desc: "Decision logging",                  owner: "REV-1", agent: "MAMMON"   },
    { id: "engine:scenario-planner", type: "strategy",    desc: "Scenario modeling",                 owner: "REV-1", agent: "MAMMON"   },
    { id: "engine:competitive-response",type:"strategy",  desc: "Competitive response",              owner: "REV-1", agent: "MAMMON"   },
    // ENGINEERING — ENG-1 / OBSIDIAN
    { id: "engine:eng-core",         type: "engineering", desc: "Engineering reasoning",             owner: "ENG-1", agent: "OBSIDIAN" },
    { id: "engine:module-builder",   type: "engineering", desc: "VYRDX module building",             owner: "ENG-1", agent: "OBSIDIAN" },
    { id: "engine:contract-deployer",type: "engineering", desc: "Smart contract deployment",         owner: "ENG-1", agent: "OBSIDIAN" },
    { id: "engine:attestation-engine",type:"engineering", desc: "Attestation token lifecycle",       owner: "ENG-1", agent: "OBSIDIAN" },
    { id: "engine:seal-engine",      type: "engineering", desc: "ExecutionSeal interaction",         owner: "ENG-1", agent: "OBSIDIAN" },
    { id: "engine:hash-anchor",      type: "engineering", desc: "State hash anchoring",              owner: "ENG-1", agent: "OBSIDIAN" },
    { id: "engine:code-review",      type: "engineering", desc: "Automated code review",             owner: "ENG-1", agent: "OBSIDIAN" },
    { id: "engine:test-runner",      type: "engineering", desc: "Test execution",                    owner: "ENG-1", agent: "OBSIDIAN" },
    { id: "engine:dependency-audit", type: "engineering", desc: "Dependency auditing",               owner: "ENG-1", agent: "OBSIDIAN" },
    { id: "engine:refactor-engine",  type: "engineering", desc: "Deterministic refactoring",         owner: "ENG-1", agent: "OBSIDIAN" },
    { id: "engine:schema-validator", type: "engineering", desc: "Schema validation",                 owner: "ENG-1", agent: "OBSIDIAN" },
    { id: "engine:migration-runner", type: "engineering", desc: "Migration execution",               owner: "ENG-1", agent: "OBSIDIAN" },
    // INFRASTRUCTURE — ENG-2 / THUNDER
    { id: "engine:infra-core",       type: "infra",       desc: "Infrastructure reasoning",          owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:ci-pipeline",      type: "infra",       desc: "CI/CD pipeline management",         owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:docker-manager",   type: "infra",       desc: "Docker orchestration",              owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:systemd-manager",  type: "infra",       desc: "Systemd unit management",           owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:nginx-config",     type: "infra",       desc: "Nginx configuration",               owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:cloudflared-tunnel",type:"infra",       desc: "Cloudflare Tunnel lifecycle",       owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:tailscale-bridge", type: "infra",       desc: "Tailscale mesh management",         owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:healthcheck",      type: "infra",       desc: "Service health monitoring",         owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:log-collector",    type: "infra",       desc: "Log aggregation",                   owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:snapshot-manager", type: "infra",       desc: "Snapshot management",               owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:rollback-engine",  type: "infra",       desc: "Rollback execution",                owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:canary-deploy",    type: "infra",       desc: "Canary deployment",                 owner: "ENG-2", agent: "THUNDER"  },
    // BUSINESS — BIZ-1 / TITAN
    { id: "engine:biz-core",         type: "business",    desc: "Business intelligence reasoning",   owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:market-scanner",   type: "business",    desc: "Market trend scanning",             owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:competitor-tracker",type:"business",    desc: "Competitor monitoring",             owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:ip-portfolio",     type: "business",    desc: "IP portfolio tracking",             owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:investor-brief",   type: "business",    desc: "Investor brief generation",         owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:pitch-builder",    type: "business",    desc: "Pitch deck structuring",            owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:crm-engine",       type: "business",    desc: "Contact management",                owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:lead-scorer",      type: "business",    desc: "Lead scoring",                      owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:email-outreach",   type: "business",    desc: "Outbound campaigns",                owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:analytics-dashboard",type:"business",   desc: "Metrics aggregation",               owner: "BIZ-1", agent: "TITAN"    },
    // DIRECTOR — DIR-1 / VYRDOX
    { id: "engine:director-core",    type: "director",    desc: "Orchestration reasoning",           owner: "DIR-1", agent: "VYRDOX"   },
    { id: "engine:task-router",      type: "director",    desc: "Task classification and routing",   owner: "DIR-1", agent: "VYRDOX"   },
    { id: "engine:agent-sync",       type: "director",    desc: "Cross-agent sync",                  owner: "DIR-1", agent: "VYRDOX"   },
    { id: "engine:queue-manager",    type: "director",    desc: "Queue management",                  owner: "DIR-1", agent: "VYRDOX"   },
    { id: "engine:certification-pipeline",type:"director",desc: "VYRDX CERTIFIED TRUE pipeline",    owner: "DIR-1", agent: "VYRDOX"   },
    { id: "engine:escalation-handler",type:"director",    desc: "Escalation routing",                owner: "DIR-1", agent: "VYRDOX"   },
    { id: "engine:priority-engine",  type: "director",    desc: "Priority calculation",              owner: "DIR-1", agent: "VYRDOX"   },
    { id: "engine:dependency-resolver",type:"director",   desc: "Task dependency resolution",        owner: "DIR-1", agent: "VYRDOX"   },
    { id: "engine:broadcast-engine", type: "director",    desc: "System-wide broadcast",             owner: "DIR-1", agent: "VYRDOX"   },
    { id: "engine:schedule-engine",  type: "director",    desc: "Scheduled execution",               owner: "DIR-1", agent: "VYRDOX"   },
    { id: "engine:conflict-resolver",type: "director",    desc: "Resource conflict resolution",      owner: "DIR-1", agent: "VYRDOX"   },
    { id: "engine:sla-monitor",      type: "director",    desc: "SLA compliance tracking",           owner: "DIR-1", agent: "VYRDOX"   },
    // COMMERCE — BIZ-1 / TITAN
    { id: "engine:storefront",       type: "commerce",    desc: "Product catalog management",        owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:checkout",         type: "commerce",    desc: "Payment processing",                owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:inventory",        type: "commerce",    desc: "Inventory tracking",                owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:shipping",         type: "commerce",    desc: "Fulfillment and shipping",          owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:subscription",     type: "commerce",    desc: "Subscription lifecycle",            owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:refund",           type: "commerce",    desc: "Refund and disputes",               owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:pricing",          type: "commerce",    desc: "Dynamic pricing",                   owner: "BIZ-1", agent: "TITAN"    },
    { id: "engine:customer-support", type: "commerce",    desc: "Customer inquiry routing",          owner: "BIZ-1", agent: "TITAN"    },
    // MARKETING — REV-1 / MAMMON
    { id: "engine:cmo-core",         type: "marketing",   desc: "Marketing strategy reasoning",      owner: "REV-1", agent: "MAMMON"   },
    { id: "engine:content-engine",   type: "marketing",   desc: "Content creation and scheduling",   owner: "REV-1", agent: "MAMMON"   },
    { id: "engine:social-engine",    type: "marketing",   desc: "Social media management",           owner: "REV-1", agent: "MAMMON"   },
    { id: "engine:seo-engine",       type: "marketing",   desc: "SEO optimization",                  owner: "REV-1", agent: "MAMMON"   },
    { id: "engine:brand-engine",     type: "marketing",   desc: "Brand consistency enforcement",     owner: "REV-1", agent: "MAMMON"   },
    { id: "engine:campaign-engine",  type: "marketing",   desc: "Campaign execution",                owner: "REV-1", agent: "MAMMON"   },
    // SERVER — ENG-2 / THUNDER
    { id: "engine:openshell",        type: "server",      desc: "Sandboxed shell execution",         owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:agent-gateway",    type: "server",      desc: "Agent-to-agent message bus",        owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:process-manager",  type: "server",      desc: "Process lifecycle management",      owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:file-watcher",     type: "server",      desc: "Filesystem event dispatch",         owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:cron-engine",      type: "server",      desc: "Scheduled job execution",           owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:webhook-receiver", type: "server",      desc: "Inbound webhook routing",           owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:socket-bridge",    type: "server",      desc: "WebSocket bridge",                  owner: "ENG-2", agent: "THUNDER"  },
    { id: "engine:backup-engine",    type: "server",      desc: "Automated backup to R2",            owner: "ENG-2", agent: "THUNDER"  },
  ];

  // KITTY Domain engines (local machine — statically declared, no live status probe)
  type KITTYDomainEngine = { id: string; type: string; desc: string; domain: string };
  const KITTY_DOMAIN_ENGINES: KITTYDomainEngine[] = [
    // security
    { id: "blackhat",          type: "security",    desc: "Offensive security simulation",              domain: "security"    },
    { id: "redhat",            type: "security",    desc: "Defensive posture analysis",                 domain: "security"    },
    { id: "perimeter_scan",    type: "security",    desc: "Network perimeter enumeration",              domain: "security"    },
    { id: "injection_audit",   type: "security",    desc: "Prompt injection + input validation",        domain: "security"    },
    { id: "key_rotation",      type: "security",    desc: "API key and secret rotation",                domain: "security"    },
    { id: "wallet_allowlist",  type: "security",    desc: "Wallet address allowlist validation",        domain: "security"    },
    { id: "threat_model",      type: "security",    desc: "Attack surface mapping",                     domain: "security"    },
    { id: "vuln_scanner",      type: "security",    desc: "Dependency and container vuln scan",         domain: "security"    },
    { id: "access_control",    type: "security",    desc: "RBAC enforcement and permission check",      domain: "security"    },
    { id: "incident_response", type: "security",    desc: "Incident detection and triage workflow",     domain: "security"    },
    // financial
    { id: "cfo_core",          type: "financial",   desc: "Central financial reasoning engine",         domain: "financial"   },
    { id: "treasury",          type: "financial",   desc: "Treasury management — wallet balances",      domain: "financial"   },
    { id: "gas_optimizer",     type: "financial",   desc: "Gas fee estimation and optimization",        domain: "financial"   },
    { id: "escrow_monitor",    type: "financial",   desc: "EscrowVault contract monitoring",            domain: "financial"   },
    { id: "burn_rate",         type: "financial",   desc: "Monthly burn rate calculation",              domain: "financial"   },
    { id: "runway_projection", type: "financial",   desc: "Financial runway projection",                domain: "financial"   },
    { id: "invoice_processor", type: "financial",   desc: "Invoice ingestion and payment scheduling",   domain: "financial"   },
    { id: "tax_engine",        type: "financial",   desc: "Tax obligation tracking and reporting",      domain: "financial"   },
    { id: "payroll",           type: "financial",   desc: "Payroll and contractor payment",             domain: "financial"   },
    { id: "financial_reporting",type:"financial",   desc: "Financial statement generation",             domain: "financial"   },
    { id: "multi_sig_orchestrator",type:"financial",desc: "Multi-sig transaction coordination",        domain: "financial"   },
    // engineering
    { id: "eng_core",          type: "engineering", desc: "Central engineering reasoning",              domain: "engineering" },
    { id: "module_builder",    type: "engineering", desc: "VYRDX module scaffolding and wiring",        domain: "engineering" },
    { id: "contract_deployer", type: "engineering", desc: "Smart contract deployment and verification", domain: "engineering" },
    { id: "attestation_engine",type: "engineering", desc: "Attestation token generation and renewal",   domain: "engineering" },
    { id: "seal_engine",       type: "engineering", desc: "ExecutionSeal interaction and hash sealing", domain: "engineering" },
    { id: "hash_anchor",       type: "engineering", desc: "State hash anchoring to Arbitrum L2",        domain: "engineering" },
    { id: "code_review",       type: "engineering", desc: "Automated code review and enforcement",      domain: "engineering" },
    { id: "test_runner",       type: "engineering", desc: "Test execution — unit, integration, adv.",   domain: "engineering" },
    { id: "dependency_audit",  type: "engineering", desc: "Package dependency auditing",                domain: "engineering" },
    { id: "schema_validator",  type: "engineering", desc: "JSON schema and data structure validation",  domain: "engineering" },
    { id: "migration_runner",  type: "engineering", desc: "Database and state migration execution",     domain: "engineering" },
    { id: "refactor_engine",   type: "engineering", desc: "Deterministic refactoring with parity check",domain: "engineering" },
    // infra
    { id: "infra_core",        type: "infra",       desc: "Infrastructure reasoning and planning",      domain: "infra"       },
    { id: "ci_pipeline",       type: "infra",       desc: "CI/CD pipeline management",                  domain: "infra"       },
    { id: "docker_manager",    type: "infra",       desc: "Docker image building and orchestration",    domain: "infra"       },
    { id: "systemd_manager",   type: "infra",       desc: "Systemd unit management",                    domain: "infra"       },
    { id: "nginx_config",      type: "infra",       desc: "Nginx configuration generation and reload",  domain: "infra"       },
    { id: "cloudflared_tunnel",type: "infra",       desc: "Cloudflare Tunnel lifecycle and routing",    domain: "infra"       },
    { id: "tailscale_bridge",  type: "infra",       desc: "Tailscale mesh management between nodes",    domain: "infra"       },
    { id: "healthcheck",       type: "infra",       desc: "Service health checks and uptime monitoring",domain: "infra"       },
    { id: "log_collector",     type: "infra",       desc: "Log aggregation and event collection",       domain: "infra"       },
    { id: "snapshot_manager",  type: "infra",       desc: "DO droplet and volume snapshot management",  domain: "infra"       },
    { id: "rollback_engine",   type: "infra",       desc: "Service and deployment rollback",            domain: "infra"       },
    { id: "canary_deploy",     type: "infra",       desc: "Canary deployment with auto-rollback",       domain: "infra"       },
    // director
    { id: "director_core",     type: "director",    desc: "Central orchestration reasoning",            domain: "director"    },
    { id: "task_router",       type: "director",    desc: "Task intake, classification, assignment",    domain: "director"    },
    { id: "queue_manager",     type: "director",    desc: "Task queue management — priority, deadlines",domain: "director"    },
    { id: "certification_pipeline",type:"director", desc: "VYRDX CERTIFIED TRUE pipeline execution",   domain: "director"    },
    { id: "escalation_handler",type: "director",    desc: "Task escalation routing and notification",   domain: "director"    },
    { id: "broadcast_engine",  type: "director",    desc: "System-wide broadcast delivery",            domain: "director"    },
    { id: "schedule_engine",   type: "director",    desc: "Scheduled task and cron-style execution",    domain: "director"    },
    // governance
    { id: "compliance_monitor",type: "governance",  desc: "Regulatory change detection — SEC, FinCEN", domain: "governance"  },
    { id: "risk_register",     type: "governance",  desc: "Enterprise risk catalog",                    domain: "governance"  },
    { id: "legal_hold",        type: "governance",  desc: "Evidence preservation triggers",             domain: "governance"  },
    // interconnect
    { id: "event_bus",         type: "interconnect",desc: "Pub/sub event bus — engines publish",        domain: "interconnect"},
    { id: "data_pipe",         type: "interconnect",desc: "Typed data pipeline between engines",        domain: "interconnect"},
    { id: "state_sync",        type: "interconnect",desc: "Shared state synchronization",               domain: "interconnect"},
    { id: "trigger_engine",    type: "interconnect",desc: "Cross-engine trigger on condition/event",    domain: "interconnect"},
    { id: "transformer",       type: "interconnect",desc: "Data shape transformation between engines",  domain: "interconnect"},
    // server
    { id: "openshell",         type: "server",      desc: "Secure sandboxed shell execution gateway",   domain: "server"      },
    { id: "process_manager",   type: "server",      desc: "Process lifecycle management",               domain: "server"      },
    { id: "file_watcher",      type: "server",      desc: "Filesystem change detection",                domain: "server"      },
    { id: "cron_engine",       type: "server",      desc: "Cron-style scheduled job execution",         domain: "server"      },
    { id: "webhook_receiver",  type: "server",      desc: "Inbound webhook reception and routing",      domain: "server"      },
    { id: "socket_bridge",     type: "server",      desc: "WebSocket bridge for real-time comms",       domain: "server"      },
    { id: "backup_engine",     type: "server",      desc: "Automated backup to Cloudflare R2",          domain: "server"      },
  ];

  // VYRDX Runtime modules (/opt/vyrdx/core/modules/*.js) — live on VYRDX node
  type VYRDXModule = { id: string; desc: string };
  const VYRDX_RUNTIME_MODULES: VYRDXModule[] = [
    { id: "analytics",   desc: "Market model + system health analytics"     },
    { id: "hardware",    desc: "CPU / memory / system metrics collection"    },
    { id: "health",      desc: "DB + Redis service health checks"           },
    { id: "market",      desc: "BTC price feed + volatility + breakout"     },
    { id: "opportunity", desc: "VYRDOX strategy and opportunity evaluation" },
    { id: "security",    desc: "Journal chain integrity + config audit"     },
    { id: "supervision", desc: "Agent supervision, drift detection, DB log" },
  ];

  // ═══════════════════════════════════════════════════════════════════════
  server.get("/rooms/monitor", async (_req, reply) => {
    function escM(s: string): string {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    async function fetchLocal(url: string): Promise<Record<string, unknown>> {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
        return (await res.json()) as Record<string, unknown>;
      } catch { return {}; }
    }

    // Fetch health (engine topology + bridge), cloud-monitor health, cloud data
    const [healthData, monHealth, monCloud] = await Promise.all([
      fetchLocal("http://127.0.0.1:7800/health"),
      fetchLocal("http://127.0.0.1:7802/health"),
      fetchLocal("http://127.0.0.1:7802/cloud"),
    ]);

    // ── Engine directory from conductor topology ─────────────────────────
    const conductor = healthData["conductor"] as Record<string, unknown> | undefined;
    const topo = conductor?.["topology"] as Record<string, unknown> | undefined;
    const engineLayers = (topo?.["engineLayers"] as Array<Record<string, unknown>> | undefined) ?? [];
    const serverLayers = (topo?.["serverLayers"] as Array<Record<string, unknown>> | undefined) ?? [];

    // Static location map — each engine/server knows where it runs
    const ENGINE_LOCATION: Record<string, string> = {
      ops:           "KITTY · /ENGINES/ceo · slot 1",
      system:        "KITTY · /ENGINES/ceo · slot 2",
      policy:        "KITTY · /ENGINES/ceo · slot 3",
      trust_closure: "KITTY · /ENGINES/ceo · slot 4",
      seal_readiness:"KITTY · /ENGINES/ceo · slot 5",
      commercial:    "KITTY · /ENGINES/ceo · slot 6",
      market:        "KITTY · /ENGINES/ceo · slot 7",
      feedback_ai:   "KITTY · /ENGINES/ceo · slot 8",
      evidence:      "KITTY · /ENGINES/ceo · slot 9",
      campaign:      "KITTY · /ENGINES/ceo · slot 10",
    };
    const SERVER_LOCATION: Record<string, string> = {
      "runtime-api": "127.0.0.1:7800 · Fastify main",
      "gateway":     "127.0.0.1:7800 · in-process layer",
      "mcp-router":  "127.0.0.1:7800 · in-process layer",
      "chat":        "vyrden.com:3001 · AI Room",
      "voice":       "vyrden.com:3001 · AI Room voice",
      "vector":      "vyrden.com:3001 · AI Room vector",
      "rag":         "vyrden.com:3001 · AI Room RAG",
      "evidence":    "KITTY · /evidence/ · hash-chain sink",
      "room-runner": "127.0.0.1:7800 · room route engine",
      "observability":"127.0.0.1:7800 · /api/observability/*",
    };

    const engineRows = engineLayers.map(e => {
      const st = String(e["status"] ?? "unknown");
      const layer = String(e["layer"] ?? "");
      const id = String(e["id"] ?? "");
      const slot = Number(e["slot"] ?? 0);
      const isOn = st === "idle" || st === "running";
      const stColor = isOn ? "#00ff88" : "#ff2244";
      const loc = ENGINE_LOCATION[layer] ?? `KITTY · /ENGINES/ceo · slot ${slot}`;
      return `<tr>
        <td style="color:#888;font-size:.58rem;text-align:center">${slot}</td>
        <td style="color:#f0f0f0;font-family:'Bebas Neue',sans-serif;letter-spacing:.08em">${escM(layer.toUpperCase())}</td>
        <td style="font-family:monospace;font-size:.55rem;color:#555">${escM(id)}</td>
        <td><span class="eng-badge ${isOn ? "on" : "off"}">${isOn ? "ON" : "OFF"}</span></td>
        <td style="font-size:.55rem;color:#444;max-width:220px">${escM(loc)}</td>
      </tr>`;
    }).join("");

    const serverRows = serverLayers.map(s => {
      const st = String(s["status"] ?? "unknown");
      const layer = String(s["layer"] ?? "");
      const id = String(s["id"] ?? "");
      const slot = Number(s["slot"] ?? 0);
      const isOn = st === "idle" || st === "running";
      const loc = SERVER_LOCATION[layer] ?? `127.0.0.1:7800 · slot ${slot}`;
      return `<tr>
        <td style="color:#888;font-size:.58rem;text-align:center">${slot}</td>
        <td style="color:#f0f0f0;font-family:'Bebas Neue',sans-serif;letter-spacing:.08em">${escM(layer.toUpperCase())}</td>
        <td style="font-family:monospace;font-size:.55rem;color:#555">${escM(id)}</td>
        <td><span class="eng-badge ${isOn ? "on" : "off"}">${isOn ? "ON" : "OFF"}</span></td>
        <td style="font-size:.55rem;color:#444;max-width:220px">${escM(loc)}</td>
      </tr>`;
    }).join("");

    // ── Cloud + market from bridge ─────────────────────────────────────
    const bridge = healthData["bridge"] as Record<string, unknown> | undefined;
    const market = bridge?.["market"] as Record<string, unknown> | undefined;
    const bridgeHealth = bridge?.["health"] as Record<string, unknown> | undefined;
    const bridgeServices = bridge?.["services"] as Record<string, unknown> | undefined;

    const btcPrice = market?.["price"] != null ? Number(market["price"]).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2}) : "—";
    const btcVolatility = market?.["volatility"] != null ? (Number(market["volatility"]) * 100).toFixed(4) + "%" : "—";
    const btcBreakout = market?.["breakout"] === true ? "YES" : "NO";
    const healthScore = bridgeHealth?.["score"] != null ? String(bridgeHealth["score"]) : "—";
    const healthOk = bridgeHealth?.["healthy"] === true;
    const chainOk = (bridgeServices?.["chainVerifierHealthy"] === true);
    const feedOk = (bridgeServices?.["feedEngineConnected"] === true);
    const attestOk = (bridgeServices?.["attestationValid"] === true);

    // ── Cloud monitor data ──────────────────────────────────────────────
    const cloudMon = monCloud as { ok?: boolean; cloud?: { health?: string; services_up?: number; services_total?: number }; services?: Array<{ name: string; port: number; up: boolean }>; error?: string };
    const monH = monHealth as { ok?: boolean; tunnel_ready?: boolean; poll_errors?: number; last_poll_ago_ms?: number | null };
    const cloudOk = cloudMon.ok === true;
    const cServices = cloudMon.services ?? [];
    const svcUp = cloudMon.cloud?.services_up ?? cServices.filter(s => s.up).length;
    const svcTotal = cloudMon.cloud?.services_total ?? cServices.length;
    const tunnelOk = monH.tunnel_ready === true;
    const pollErrors = monH.poll_errors ?? 0;

    const svcRows = cServices.map(s => {
      const c = s.up ? "#00ff88" : "#ff2244";
      return `<tr><td style="font-family:monospace;font-size:.6rem;color:#555">:${s.port}</td><td>${escM(s.name)}</td><td><span style="color:${c};font-family:'Bebas Neue',sans-serif;letter-spacing:.08em">${s.up ? "UP" : "DOWN"}</span></td></tr>`;
    }).join("");

    // ── VYRDX snapshot analytics ────────────────────────────────────────
    const snap = await fetchLocal("http://127.0.0.1:7800/api/observability/snapshot").catch(() => ({}));
    const snapData = (snap as { snapshot?: Record<string, unknown> })?.snapshot ?? {};
    const hw = snapData["hardware"] as Record<string, unknown> | undefined;
    const security = snapData["security"] as Record<string, unknown> | undefined;
    const analytics = snapData["analytics"] as Record<string, unknown> | undefined;
    const supervision = snapData["supervision"] as Record<string, unknown> | undefined;

    const engOnCount = engineLayers.filter(e => { const s = String(e["status"] ?? ""); return s === "idle" || s === "running"; }).length;
    const srvOnCount = serverLayers.filter(s => { const st = String(s["status"] ?? ""); return st === "idle" || st === "running"; }).length;

    // ── Build static group rows ──────────────────────────────────────────
    // Type-colour map
    const TYPE_COLOR: Record<string, string> = {
      security: "#ff2244", financial: "#ffaa00", strategy: "#aa66ff",
      engineering: "#00ccff", infra: "#00ff88", business: "#ff9f4a",
      director: "#ff6600", commerce: "#ffcc00", marketing: "#ff66aa",
      server: "#00ff88", governance: "#888", interconnect: "#55ddff",
    };
    const escMon = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

    // AI Room rows — grouped by owner/agent
    const aiAgentOrder = ["SEC-1","CFO-1","REV-1","ENG-1","ENG-2","BIZ-1","DIR-1"];
    const aiAgentNames: Record<string,string> = { "SEC-1":"ABYSSAL","CFO-1":"LEVERAGE","REV-1":"MAMMON","ENG-1":"OBSIDIAN","ENG-2":"THUNDER","BIZ-1":"TITAN","DIR-1":"VYRDOX" };
    const aiRoomRows = aiAgentOrder.flatMap(owner => {
      const group = AI_ROOM_ENGINES.filter(e => e.owner === owner);
      if (!group.length) return [];
      const agentName = aiAgentNames[owner] ?? owner;
      const agentColor = (group[0] ? TYPE_COLOR[group[0].type] : undefined) ?? "#555";
      const header = `<tr><td colspan="5" style="background:#0a0a0a;padding:.5rem .8rem;font-family:'Bebas Neue',sans-serif;font-size:.75rem;letter-spacing:.2em;color:${agentColor};border-top:1px solid #111">${escMon(owner)} · ${escMon(agentName)}</td></tr>`;
      const rows = group.map((e, i) => {
        const tc = TYPE_COLOR[e.type] ?? "#555";
        return `<tr>
          <td style="color:#333;font-size:.55rem;text-align:center">${i + 1}</td>
          <td style="font-family:monospace;font-size:.58rem;color:#888">${escMon(e.id)}</td>
          <td><span style="font-family:'Bebas Neue',sans-serif;font-size:.6rem;letter-spacing:.08em;color:${tc}">${escMon(e.type.toUpperCase())}</span></td>
          <td style="font-size:.55rem;color:#555">${escMon(e.desc)}</td>
          <td style="font-size:.55rem;text-align:center"><span style="font-family:'Bebas Neue',sans-serif;font-size:.6rem;letter-spacing:.1em;padding:.1rem .5rem;border:1px solid #1a1a1a;color:#555">STATIC</span></td>
        </tr>`;
      }).join("");
      return [header + rows];
    }).join("");

    // KITTY Domain rows — grouped by domain/type
    const domainOrder = ["security","financial","engineering","infra","director","governance","interconnect","server"];
    const kittyDomainRows = domainOrder.flatMap(dom => {
      const group = KITTY_DOMAIN_ENGINES.filter(e => e.domain === dom);
      if (!group.length) return [];
      const tc = TYPE_COLOR[dom] ?? "#555";
      const header = `<tr><td colspan="4" style="background:#0a0a0a;padding:.5rem .8rem;font-family:'Bebas Neue',sans-serif;font-size:.75rem;letter-spacing:.2em;color:${tc};border-top:1px solid #111">${dom.toUpperCase()}</td></tr>`;
      const rows = group.map((e, i) => `<tr>
        <td style="color:#333;font-size:.55rem;text-align:center">${i + 1}</td>
        <td style="font-family:monospace;font-size:.58rem;color:#888">${escMon(e.id)}</td>
        <td><span style="font-family:'Bebas Neue',sans-serif;font-size:.6rem;letter-spacing:.08em;color:${tc}">${escMon(e.type.toUpperCase())}</span></td>
        <td style="font-size:.55rem;color:#555">${escMon(e.desc)}</td>
      </tr>`).join("");
      return [header + rows];
    }).join("");

    // VYRDX Runtime rows
    const vyrdxRows = VYRDX_RUNTIME_MODULES.map((m, i) => `<tr>
      <td style="color:#333;font-size:.55rem;text-align:center">${i + 1}</td>
      <td style="font-family:monospace;font-size:.58rem;color:#888">/opt/vyrdx/core/modules/${escMon(m.id)}.js</td>
      <td style="font-size:.55rem;color:#555">${escMon(m.desc)}</td>
      <td style="font-size:.55rem;text-align:center"><span style="font-family:'Bebas Neue',sans-serif;font-size:.6rem;letter-spacing:.1em;padding:.1rem .5rem;border:1px solid #1a1a1a;color:#555">VYRDX NODE</span></td>
    </tr>`).join("");

    const totalEngines = AI_ROOM_ENGINES.length + KITTY_DOMAIN_ENGINES.length + (engOnCount + (engineLayers.length - engOnCount)) + (srvOnCount + (serverLayers.length - srvOnCount)) + VYRDX_RUNTIME_MODULES.length;

    return reply.type("text/html").send(`<!DOCTYPE html><html lang="en"><head>
<title>Monitor — KITTY VXStation</title>${H}
<style>
.eng-badge{font-family:'Bebas Neue',sans-serif;font-size:.65rem;letter-spacing:.1em;padding:.15rem .6rem;border:1px solid;display:inline-block}
.eng-badge.on{color:#00ff88;border-color:#00ff88;background:rgba(0,255,136,.06)}
.eng-badge.off{color:#ff2244;border-color:#ff2244;background:rgba(255,34,68,.06)}
.mkt-val{font-family:'Bebas Neue',sans-serif;font-size:2.2rem;letter-spacing:.05em;line-height:1.1}
.mkt-sub{font-size:.55rem;color:#555;letter-spacing:.18em;text-transform:uppercase;margin-top:.3rem}
.mkt-box{border:1px solid #1a1a1a;padding:1.4rem;background:#0a0a0a;text-align:center}
.eng-section-title{font-family:'Bebas Neue',sans-serif;font-size:1rem;letter-spacing:.2em;color:#555;padding:.6rem 0;border-bottom:1px solid #0f0f0f;margin-bottom:.8rem;display:flex;align-items:center;gap:.6rem}
.eng-section-title .dot{width:5px;height:5px;border-radius:50%}
.live-pulse{display:inline-block;width:6px;height:6px;border-radius:50%;background:#00ff88;animation:pulse 2s infinite;margin-right:.4rem;vertical-align:middle}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
</style>
</head><body>
<canvas id="bg"></canvas>
<div class="page">
  ${TNAV("monitor")}
  <div class="nav"><div class="nav-title" style="color:#ff9f4a">MONITOR</div><div class="nav-badge">ENGINE DIR · MARKET · CLOUD</div></div>
  <div class="enforce">KITTY OBSERVES — NEVER COMMANDS · ENGINE DIRECTORY LIVE · BOUNDARY LAW ENFORCED</div>

  <!-- KPI ROW -->
  <div class="kpi-grid">
    <div class="kpi" style="border-color:#1a1a1a">
      <div class="kpi-val" style="color:#aa66ff;font-size:1.6rem">${totalEngines}</div>
      <div class="kpi-label">TOTAL ENGINES</div>
    </div>
    <div class="kpi" style="border-color:#1a1a1a">
      <div class="kpi-val" style="color:#ff2244;font-size:1.3rem">${AI_ROOM_ENGINES.length}</div>
      <div class="kpi-label">AI ROOM · VYRDEN.COM</div>
    </div>
    <div class="kpi" style="border-color:#1a1a1a">
      <div class="kpi-val" style="color:#00ccff;font-size:1.3rem">${KITTY_DOMAIN_ENGINES.length}</div>
      <div class="kpi-label">KITTY DOMAIN</div>
    </div>
    <div class="kpi" style="border-color:#1a1a1a">
      <div class="kpi-val" style="color:#00ff88">${engOnCount}/${engineLayers.length}</div>
      <div class="kpi-label">CEO ENG LAYERS ON</div>
    </div>
    <div class="kpi" style="border-color:#1a1a1a">
      <div class="kpi-val" style="color:#00ccff">${srvOnCount}/${serverLayers.length}</div>
      <div class="kpi-label">CEO SRV LAYERS ON</div>
    </div>
    <div class="kpi" style="border-color:#1a1a1a">
      <div class="kpi-val" style="color:#ff9f4a;font-size:1.3rem">${VYRDX_RUNTIME_MODULES.length}</div>
      <div class="kpi-label">VYRDX RUNTIME MODS</div>
    </div>
    <div class="kpi" style="border-color:#1a1a1a">
      <div class="kpi-val" id="kpi-btc" style="color:#ffaa00">${btcPrice !== "—" ? "$" + btcPrice : "—"}</div>
      <div class="kpi-label">BTC / USD</div>
    </div>
    <div class="kpi" style="border-color:#1a1a1a">
      <div class="kpi-val" style="color:${healthOk ? "#00ff88" : "#ff2244"}">${healthScore}</div>
      <div class="kpi-label">BRIDGE HEALTH SCORE</div>
    </div>
    <div class="kpi" style="border-color:#1a1a1a">
      <div class="kpi-val" style="color:${cloudOk ? "#00ff88" : "#ff2244"}">${cloudOk ? "LIVE" : "FAULT"}</div>
      <div class="kpi-label">CLOUD STATUS</div>
    </div>
    <div class="kpi" style="border-color:#1a1a1a">
      <div class="kpi-val" style="color:${tunnelOk ? "#00ff88" : "#ff2244"}">${tunnelOk ? "OK" : "DOWN"}</div>
      <div class="kpi-label">SSH TUNNEL</div>
    </div>
  </div>

  <!-- MARKET DATA FEED -->
  <div class="card" style="border-color:#1e1400">
    <div class="card-hd"><div class="dot" style="background:#ffaa00"></div> MARKET FEED — VYRDX BRIDGE <span class="live-pulse"></span><span style="font-size:.5rem;color:#555;letter-spacing:.1em;margin-left:.5rem">LIVE · AUTO-REFRESHES 30s</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem">
      <div class="mkt-box">
        <div class="mkt-val" id="mkt-price" style="color:#ffaa00">${btcPrice !== "—" ? "$" + btcPrice : "—"}</div>
        <div class="mkt-sub">BTC / USD PRICE</div>
      </div>
      <div class="mkt-box">
        <div class="mkt-val" style="color:#00ccff">${btcVolatility}</div>
        <div class="mkt-sub">VOLATILITY</div>
      </div>
      <div class="mkt-box">
        <div class="mkt-val" style="color:${btcBreakout === "YES" ? "#ff6600" : "#555"}">${btcBreakout}</div>
        <div class="mkt-sub">BREAKOUT SIGNAL</div>
      </div>
      <div class="mkt-box">
        <div class="mkt-val" style="font-size:1.2rem;color:#888" id="mkt-mode">${escM(String(analytics?.["mode"] ?? "—"))}</div>
        <div class="mkt-sub">ANALYTICS MODE</div>
      </div>
      <div class="mkt-box">
        <div class="mkt-val" style="font-size:1.4rem;color:#00ff88" id="mkt-conf">${analytics?.["confidence"] != null ? (Number(analytics["confidence"]) * 100).toFixed(2) + "%" : "—"}</div>
        <div class="mkt-sub">CONFIDENCE</div>
      </div>
      <div class="mkt-box">
        <div class="mkt-val" style="font-size:1.3rem;color:${(supervision?.["drifting"] === true) ? "#ff6600" : "#00ff88"}" id="mkt-drift">${supervision?.["drifting"] === true ? "DRIFTING" : "STABLE"}</div>
        <div class="mkt-sub">SUPERVISION STATE</div>
      </div>
    </div>
    <div style="margin-top:1rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.6rem">
      <div class="row"><span class="l">CHAIN VERIFIER</span><span class="v" style="color:${chainOk ? "#00ff88" : "#ff2244"}">${chainOk ? "HEALTHY" : "DOWN"}</span></div>
      <div class="row"><span class="l">FEED ENGINE</span><span class="v" style="color:${feedOk ? "#00ff88" : "#ff2244"}">${feedOk ? "CONNECTED" : "DISCONNECTED"}</span></div>
      <div class="row"><span class="l">ATTESTATION</span><span class="v" style="color:${attestOk ? "#00ff88" : "#ff2244"}">${attestOk ? "VALID" : "INVALID"}</span></div>
      <div class="row"><span class="l">CPU LOAD</span><span class="v">${hw?.["load"] != null ? Number(hw["load"]).toFixed(1) + "%" : "—"}</span></div>
      <div class="row"><span class="l">CPU TEMP</span><span class="v" style="color:${Number(hw?.["cpuTempC"] ?? 0) > 85 ? "#ff6600" : "#ccc"}">${hw?.["cpuTempC"] != null ? Number(hw["cpuTempC"]).toFixed(1) + "°C" : "—"}</span></div>
      <div class="row"><span class="l">MEM FREE</span><span class="v">${hw?.["memoryFreeRatio"] != null ? (Number(hw["memoryFreeRatio"]) * 100).toFixed(1) + "%" : "—"}</span></div>
    </div>
  </div>

  <!-- ENGINE LAYERS DIRECTORY -->
  <div class="card">
    <div class="card-hd"><div class="dot" style="background:#00ff88"></div> CEO ENGINE LAYERS — DIRECTORY (${engOnCount}/${engineLayers.length} ON)</div>
    <div class="eng-section-title"><div class="dot" style="background:#00ff88"></div> EXECUTION LAYERS</div>
    <div style="overflow-x:auto">
    <table>
      <thead><tr>
        <th style="width:40px">#</th>
        <th>LAYER</th>
        <th>ENGINE ID</th>
        <th>STATUS</th>
        <th>LOCATION</th>
      </tr></thead>
      <tbody>${engineRows}</tbody>
    </table>
    </div>
  </div>

  <!-- SERVER LAYERS DIRECTORY -->
  <div class="card">
    <div class="card-hd"><div class="dot" style="background:#00ccff"></div> CEO SERVER LAYERS — DIRECTORY (${srvOnCount}/${serverLayers.length} ON)</div>
    <div class="eng-section-title"><div class="dot" style="background:#00ccff"></div> SERVER NODES</div>
    <div style="overflow-x:auto">
    <table>
      <thead><tr>
        <th style="width:40px">#</th>
        <th>LAYER</th>
        <th>SERVER ID</th>
        <th>STATUS</th>
        <th>LOCATION</th>
      </tr></thead>
      <tbody>${serverRows}</tbody>
    </table>
    </div>
  </div>

  <!-- AI ROOM ENGINE DIRECTORY -->
  <div class="card" style="border-color:#1a0a0a">
    <div class="card-hd"><div class="dot" style="background:#ff2244"></div> VYRDEN AI ROOM — ENGINE DIRECTORY (${AI_ROOM_ENGINES.length} ENGINES · 7 AGENTS) <span style="font-size:.5rem;color:#555;letter-spacing:.1em;margin-left:.6rem">HOST: VYRDEN.COM · DROPLET · STATIC CATALOG</span></div>
    <div style="overflow-x:auto">
    <table>
      <thead><tr>
        <th style="width:36px">#</th>
        <th>ENGINE ID</th>
        <th>TYPE</th>
        <th>DESCRIPTION</th>
        <th>STATUS</th>
      </tr></thead>
      <tbody>${aiRoomRows}</tbody>
    </table>
    </div>
  </div>

  <!-- KITTY DOMAIN ENGINE DIRECTORY -->
  <div class="card" style="border-color:#0a1020">
    <div class="card-hd"><div class="dot" style="background:#00ccff"></div> KITTY DOMAIN ENGINES — DIRECTORY (${KITTY_DOMAIN_ENGINES.length} ENGINES) <span style="font-size:.5rem;color:#555;letter-spacing:.1em;margin-left:.6rem">HOST: KITTY LOCAL · /ENGINES/*</span></div>
    <div style="overflow-x:auto">
    <table>
      <thead><tr>
        <th style="width:36px">#</th>
        <th>ENGINE ID</th>
        <th>TYPE</th>
        <th>DESCRIPTION</th>
      </tr></thead>
      <tbody>${kittyDomainRows}</tbody>
    </table>
    </div>
  </div>

  <!-- VYRDX RUNTIME MODULES -->
  <div class="card" style="border-color:#0e0a00">
    <div class="card-hd"><div class="dot" style="background:#ff9f4a"></div> VYRDX RUNTIME MODULES — DIRECTORY (${VYRDX_RUNTIME_MODULES.length} MODULES) <span style="font-size:.5rem;color:#555;letter-spacing:.1em;margin-left:.6rem">HOST: /OPT/VYRDX/CORE/MODULES · VYRDX NODE</span></div>
    <div style="overflow-x:auto">
    <table>
      <thead><tr>
        <th style="width:36px">#</th>
        <th>MODULE PATH</th>
        <th>DESCRIPTION</th>
        <th>NODE</th>
      </tr></thead>
      <tbody>${vyrdxRows}</tbody>
    </table>
    </div>
  </div>

  <!-- CLOUD SERVICES -->
  <div class="grid g2">
    <div class="card">
      <div class="card-hd"><div class="dot" style="background:#ff9f4a"></div> VYRDX CLOUD — DROPLET (134.199.227.138)</div>
      <div class="row"><span class="l">CLOUD STATUS</span><span class="v" style="color:${cloudOk ? "#00ff88" : "#ff2244"}">${cloudOk ? "LIVE" : "FAULT"}</span></div>
      <div class="row"><span class="l">SERVICES</span><span class="v">${svcUp} / ${svcTotal} UP</span></div>
      <div class="row"><span class="l">SSH TUNNEL</span><span class="v" style="color:${tunnelOk ? "#00ff88" : "#ff2244"}">${tunnelOk ? "READY" : "DOWN"}</span></div>
      <div class="row"><span class="l">POLL ERRORS</span><span class="v" style="color:${pollErrors > 0 ? "#ff2244" : "#00ff88"}">${pollErrors}</span></div>
      ${cloudMon.error ? `<div class="alert alert-e" style="margin-top:.8rem">${escM(String(cloudMon.error))}</div>` : ""}
    </div>
    <div class="card">
      <div class="card-hd"><div class="dot" style="background:#00ff88"></div> VYRDX SERVICES</div>
      ${cServices.length > 0 ? `<table><thead><tr><th>PORT</th><th>SERVICE</th><th>STATUS</th></tr></thead><tbody>${svcRows}</tbody></table>` : `<div style="color:#333;font-size:.7rem;padding:1rem 0;text-align:center">NO SERVICE DATA — IS CLOUD-MONITOR RUNNING?<br><span style="font-size:.55rem;color:#222">Run: tsx server/cloud-monitor.ts</span></div>`}
    </div>
  </div>

  <!-- ACTIONS -->
  <div class="card">
    <div class="card-hd"><div class="dot" style="background:#555"></div> ACTIONS</div>
    <div style="display:flex;gap:.8rem;flex-wrap:wrap;padding:.4rem 0">
      <button class="btn btn-sm" onclick="location.reload()">REFRESH ALL</button>
      <button class="btn btn-sm" onclick="fetchAction('MARKET','/api/monitor/market')">FETCH MARKET</button>
      <button class="btn btn-sm" onclick="fetchAction('CLOUD','/api/monitor/rooms')">FETCH CLOUD ROOMS</button>
      <button class="btn btn-sm" onclick="fetchAction('ENGINES','/api/monitor/engines')">FETCH ENGINE DIR</button>
      <button class="btn btn-sm" onclick="fetchAction('SNAPSHOT','/api/observability/snapshot')">FETCH SNAPSHOT</button>
    </div>
    <div id="action-out" style="margin-top:1rem;font-size:.6rem;color:#555;font-family:monospace;white-space:pre-wrap;max-height:240px;overflow:auto;background:#050505;padding:.8rem;border:1px solid #111"></div>
  </div>

  ${FT("MONITOR")}
</div>
<script>
function fetchAction(label,url){
  var el=document.getElementById('action-out');
  el.textContent=label+' loading…';
  fetch(url).then(function(r){return r.json()}).then(function(d){
    el.textContent=label+':\n'+JSON.stringify(d,null,2);
    el.style.color='#00ff88';
  }).catch(function(e){el.textContent=label+' ERROR: '+e.message;el.style.color='#ff2244'});
}

// Live market refresh every 30s
function refreshMarket(){
  fetch('/api/observability/snapshot').then(function(r){return r.json()}).then(function(d){
    var s=d&&d.snapshot;if(!s)return;
    var price=s.market&&s.market.price;
    if(price){
      var fmt='$'+parseFloat(price).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
      var el=document.getElementById('mkt-price');if(el)el.textContent=fmt;
      var kpi=document.getElementById('kpi-btc');if(kpi)kpi.textContent=fmt;
    }
    if(s.analytics){
      var mc=document.getElementById('mkt-conf');
      if(mc&&s.analytics.confidence!=null)mc.textContent=(parseFloat(s.analytics.confidence)*100).toFixed(2)+'%';
      var mm=document.getElementById('mkt-mode');
      if(mm&&s.analytics.mode)mm.textContent=s.analytics.mode;
    }
    if(s.supervision){
      var md=document.getElementById('mkt-drift');
      if(md)md.textContent=s.supervision.drifting?'DRIFTING':'STABLE';
    }
  }).catch(function(){});
}
refreshMarket();
setInterval(refreshMarket,30000);
<\/script>
${ROOM_BG}
</body></html>`);
  });

  // ── Monitor proxy API routes (delegate to cloud-monitor process on :7802) ─
  server.get("/api/monitor/rooms", async (_req, reply) => {
    try {
      const res = await fetch("http://127.0.0.1:7802/cloud/rooms", { signal: AbortSignal.timeout(8_000) });
      const data = await res.json();
      return reply.status(res.status).send(data);
    } catch (e) {
      return reply.status(503).send({ error: "cloud-monitor unreachable", detail: e instanceof Error ? e.message : String(e) });
    }
  });

  server.get("/api/monitor/market", async (_req, reply) => {
    try {
      const res = await fetch("http://127.0.0.1:7802/cloud/market", { signal: AbortSignal.timeout(8_000) });
      const data = await res.json();
      return reply.status(res.status).send(data);
    } catch (e) {
      // Fallback: read directly from bridge snapshot
      try {
        const snap = await fetch("http://127.0.0.1:7800/api/observability/snapshot", { signal: AbortSignal.timeout(5_000) });
        const sd = await snap.json() as { snapshot?: { market?: unknown } };
        return reply.send({ source: "bridge_fallback", market: sd?.snapshot?.market ?? null });
      } catch {
        return reply.status(503).send({ error: "market data unavailable", detail: e instanceof Error ? e.message : String(e) });
      }
    }
  });

  server.get("/api/monitor/audit", async (_req, reply) => {
    try {
      const res = await fetch("http://127.0.0.1:7802/cloud/audit", { signal: AbortSignal.timeout(8_000) });
      const data = await res.json();
      return reply.status(res.status).send(data);
    } catch (e) {
      return reply.status(503).send({ error: "cloud-monitor unreachable", detail: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── Engine directory API — returns ALL groups: AI Room, KITTY CEO, KITTY Domain, VYRDX Runtime ─
  server.get("/api/monitor/engines", async (_req, reply) => {
    // Fetch live CEO layer status from conductor health
    let engineLayers: Array<Record<string, unknown>> = [];
    let serverLayers: Array<Record<string, unknown>> = [];
    try {
      const res = await fetch("http://127.0.0.1:7800/health", { signal: AbortSignal.timeout(5_000) });
      const health = await res.json() as { conductor?: { topology?: { engineLayers?: unknown[]; serverLayers?: unknown[] } } };
      const topo = health?.conductor?.topology ?? {};
      engineLayers = ((topo as { engineLayers?: Array<Record<string, unknown>> })?.engineLayers ?? []);
      serverLayers = ((topo as { serverLayers?: Array<Record<string, unknown>> })?.serverLayers ?? []);
    } catch { /* health unavailable — ceo layers will be empty */ }

    const ENGINE_LOCATION: Record<string, string> = {
      ops:           "KITTY · /ENGINES/ceo · slot 1",
      system:        "KITTY · /ENGINES/ceo · slot 2",
      policy:        "KITTY · /ENGINES/ceo · slot 3",
      trust_closure: "KITTY · /ENGINES/ceo · slot 4",
      seal_readiness:"KITTY · /ENGINES/ceo · slot 5",
      commercial:    "KITTY · /ENGINES/ceo · slot 6",
      market:        "KITTY · /ENGINES/ceo · slot 7",
      feedback_ai:   "KITTY · /ENGINES/ceo · slot 8",
      evidence:      "KITTY · /ENGINES/ceo · slot 9",
      campaign:      "KITTY · /ENGINES/ceo · slot 10",
    };
    const SERVER_LOCATION: Record<string, string> = {
      "runtime-api":  "127.0.0.1:7800 · Fastify main",
      "gateway":      "127.0.0.1:7800 · in-process layer",
      "mcp-router":   "127.0.0.1:7800 · in-process layer",
      "chat":         "vyrden.com:3001 · AI Room",
      "voice":        "vyrden.com:3001 · AI Room voice",
      "vector":       "vyrden.com:3001 · AI Room vector",
      "rag":          "vyrden.com:3001 · AI Room RAG",
      "evidence":     "KITTY · /evidence/ · hash-chain sink",
      "room-runner":  "127.0.0.1:7800 · room route engine",
      "observability":"127.0.0.1:7800 · /api/observability/*",
    };

    const ceoEngines = engineLayers.map(e => ({
      slot: e["slot"], layer: e["layer"], id: e["id"], status: e["status"],
      on: e["status"] === "idle" || e["status"] === "running",
      location: ENGINE_LOCATION[String(e["layer"] ?? "")] ?? `KITTY · /ENGINES/ceo · slot ${e["slot"]}`,
    }));
    const ceoServers = serverLayers.map(s => ({
      slot: s["slot"], layer: s["layer"], id: s["id"], status: s["status"],
      on: s["status"] === "idle" || s["status"] === "running",
      location: SERVER_LOCATION[String(s["layer"] ?? "")] ?? `127.0.0.1:7800 · slot ${s["slot"]}`,
    }));

    return reply.send({
      ok: true,
      timestamp: new Date().toISOString(),
      summary: {
        total: AI_ROOM_ENGINES.length + KITTY_DOMAIN_ENGINES.length + ceoEngines.length + ceoServers.length + VYRDX_RUNTIME_MODULES.length,
        ai_room: AI_ROOM_ENGINES.length,
        kitty_domain: KITTY_DOMAIN_ENGINES.length,
        kitty_ceo_engines: ceoEngines.length,
        kitty_ceo_servers: ceoServers.length,
        vyrdx_runtime: VYRDX_RUNTIME_MODULES.length,
      },
      groups: {
        ai_room: {
          host: "vyrden.com · Droplet",
          count: AI_ROOM_ENGINES.length,
          engines: AI_ROOM_ENGINES,
        },
        kitty_ceo: {
          host: "KITTY · /ENGINES/ceo",
          engine_layers: ceoEngines,
          server_layers: ceoServers,
        },
        kitty_domain: {
          host: "KITTY · /ENGINES/*",
          count: KITTY_DOMAIN_ENGINES.length,
          engines: KITTY_DOMAIN_ENGINES,
        },
        vyrdx_runtime: {
          host: "/opt/vyrdx/core/modules",
          count: VYRDX_RUNTIME_MODULES.length,
          modules: VYRDX_RUNTIME_MODULES,
        },
      },
    });
  });
}
