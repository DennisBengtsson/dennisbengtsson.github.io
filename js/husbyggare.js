/*
 * husbyggare.js – väggtyper, U-värde och planritning (husbyggare.html).
 *
 * Allt sparas i besökarens egen webbläsare (localStorage) och kan laddas ner/öppnas
 * som en projektfil. Inget skickas någonstans. Inga inline-händelser: alla knappar
 * kopplas längst ner, så att sidans säkerhetsregel (CSP) kan förbjuda inline-skript.
 */
(function () {
"use strict";
/* ---------------- data ---------------- */
const CAT = {
  fasad:{n:"Fasad",c:"#a9743f",hatch:"wood"},
  luft:{n:"Luftspalt",c:"#eef3f6",hatch:"air"},
  skiva:{n:"Skiva",c:"#d9d2c2",hatch:"board"},
  isol:{n:"Isolering",c:"#f2d98a",hatch:"insul"},
  stomme:{n:"Regelverk + isolering",c:"#f2d98a",hatch:"stud"},
  sparr:{n:"Spärrskikt",c:"#8fb8d8",hatch:"foil"},
  gips:{n:"Gips",c:"#e9e6df",hatch:"gyp"},
  betong:{n:"Betong",c:"#c9c9c4",hatch:"conc"}
};
const PRESETS = [
  ["Träpanel 22 mm","fasad",22,0.14],
  ["Spikläkt / luftspalt 34 mm","luft",34,0.5],
  ["Västkustskiva 9 mm","skiva",9,0.09],
  ["Utegips 9 mm","skiva",9,0.22],
  ["Vindskyddsskiva 25 mm","isol",25,0.033],
  ["Stomme 220 stenull","stomme",220,0.034],
  ["Stomme 170 stenull","stomme",170,0.034],
  ["Stomme 145 mineralull","stomme",145,0.036],
  ["Plastfolie (ångspärr)","sparr",0.2,0.33],
  ["Installationsvägg 45 isolerad","stomme",45,0.036],
  ["OSB 12 mm","skiva",12,0.13],
  ["Plywood 12 mm","skiva",12,0.13],
  ["Gips 13 mm","gips",13,0.22],
  ["Tegel 120 mm","fasad",120,0.60],
  ["Betong 200 mm","betong",200,1.7],
  ["Cellplast EPS 100","isol",100,0.037]
];

let DB = { walls:[], active:0 };

function defaultWall(){
  return { name:"Yttervägg 220+45", studFrac:0.12, layers:[
    {n:"Träfasad",k:"fasad",t:22,l:0.14},
    {n:"Luftspalt / spikläkt",k:"luft",t:34,l:0.5},
    {n:"Västkustskiva",k:"skiva",t:9,l:0.09},
    {n:"Utegips",k:"skiva",t:9,l:0.22},
    {n:"Stomme 220, stenull",k:"stomme",t:220,l:0.034},
    {n:"Plastfolie",k:"sparr",t:0.2,l:0.33},
    {n:"Installationsvägg 45, isolerad",k:"stomme",t:45,l:0.036},
    {n:"OSB",k:"skiva",t:12,l:0.13},
    {n:"Gips",k:"gips",t:13,l:0.22},
    {n:"Gips",k:"gips",t:13,l:0.22}
  ]};
}
function innerWall(){
  return { name:"Innervägg 70", studFrac:0.15, layers:[
    {n:"Gips",k:"gips",t:13,l:0.22},
    {n:"Stomme 70, mineralull",k:"stomme",t:70,l:0.036},
    {n:"Gips",k:"gips",t:13,l:0.22}
  ]};
}
DB.walls = [defaultWall(), innerWall()];

const W = () => DB.walls[DB.active];

/* ---------------- ui: layers ---------------- */
const $ = s => document.querySelector(s);
let dragIdx = null;

function render(){
  const w = W();
  $("#wtName").textContent = w.name;
  const tb = $("#layers tbody"); tb.innerHTML = "";
  w.layers.forEach((L,i)=>{
    const tr = document.createElement("tr");
    tr.draggable = true;
    tr.ondragstart = e => { dragIdx = i; e.dataTransfer.effectAllowed="move"; };
    tr.ondragover = e => { e.preventDefault(); tr.classList.add("drag-over"); };
    tr.ondragleave = () => tr.classList.remove("drag-over");
    tr.ondrop = e => { e.preventDefault(); tr.classList.remove("drag-over");
      if(dragIdx===null||dragIdx===i) return;
      const m = w.layers.splice(dragIdx,1)[0]; w.layers.splice(i,0,m); dragIdx=null; render(); };
    tr.dataset.i = i;
    tr.innerHTML = `
      <td class="grip" title="Dra för att flytta">⠿</td>
      <td><input class="hb-full" value="${esc(L.n)}" data-f="n" aria-label="Skiktets namn"></td>
      <td><select data-f="k" aria-label="Typ">${Object.keys(CAT).map(k=>
          `<option value="${k}" ${k===L.k?"selected":""}>${CAT[k].n}</option>`).join("")}</select></td>
      <td><input type="number" step="0.1" value="${esc(L.t)}" class="hb-w62" data-f="t" aria-label="Tjocklek i mm"></td>
      <td><input type="number" step="0.001" value="${esc(L.l)}" class="hb-w70" data-f="l" aria-label="Lambda-värde"></td>
      <td class="hb-nowrap">
        <button type="button" class="mini" data-skikt="upp" title="Flytta upp">↑</button>
        <button type="button" class="mini" data-skikt="ner" title="Flytta ner">↓</button>
        <button type="button" class="mini danger" data-skikt="bort" title="Ta bort">×</button></td>`;
    tb.appendChild(tr);
  });
  calc(); drawSection(); drawLib(); syncActiveWallSelect();
}
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
function setL(i,k,v){ W().layers[i][k]=v; calc(); drawSection(); }
function mv(i,d){ const L=W().layers,j=i+d; if(j<0||j>=L.length)return; [L[i],L[j]]=[L[j],L[i]]; render(); }
function del(i){ W().layers.splice(i,1); render(); }
function addLayer(){ W().layers.push({n:"Nytt skikt",k:"skiva",t:10,l:0.13}); render(); }
function addPreset(sel){
  const p = PRESETS[sel.value]; if(!p) return;
  W().layers.push({n:p[0],k:p[1],t:p[2],l:p[3]}); sel.value=""; render();
}
$("#preset").innerHTML = '<option value="">Snabbval…</option>' +
  PRESETS.map((p,i)=>`<option value="${i}">${p[0]}</option>`).join("");

/* ---------------- calc ---------------- */
function calc(){
  const w = W(), L = w.layers;
  const tot = L.reduce((a,x)=>a+ +x.t,0);
  const ins = L.filter(x=>x.k==="isol"||x.k==="stomme").reduce((a,x)=>a+ +x.t,0);
  $("#tot").textContent = fmt(tot)+" mm";
  $("#ins").textContent = fmt(ins)+" mm";
  $("#cnt").textContent = L.length;

  const studAware = $("#studmode").value === "1";
  let R = 0.13 + 0.04, ok = true;
  L.forEach(x=>{
    const t = +x.t/1000;
    if(x.k==="luft"){ R += 0.18; return; }
    let lam = +x.l;
    if(x.k==="stomme" && studAware){
      const f = w.studFrac ?? 0.12;
      lam = (1-f)*lam + f*0.12;
    }
    if(!lam || lam<=0){ ok=false; return; }
    R += t/lam;
  });
  const U = 1/R;
  $("#uval").textContent = ok ? U.toFixed(3).replace(".",",")+" W/m²K" : "—";
  $("#unote").textContent = ok
    ? "R = "+R.toFixed(2).replace(".",",")+" m²K/W" + (studAware?" · regelandel "+Math.round((w.studFrac??.12)*100)+"%":"")
    : "Ange λ-värde för alla skikt.";
  $("#awinfo").textContent = W().name+" · "+fmt(tot)+" mm";
  renderClass(ok ? U : null);
}

const ESCALE = [
  {k:"A+", max:0.10, c:"#1f6feb", t:"Bättre än passivhuskrav"},
  {k:"A",  max:0.13, c:"#1a7f4b", t:"Passivhusnivå (FEBY)"},
  {k:"B",  max:0.16, c:"#4a9d3a", t:"Klart bättre än BBR"},
  {k:"C",  max:0.18, c:"#8fb02b", t:"Möter BBR-referensvärde"},
  {k:"D",  max:0.25, c:"#d6a41c", t:"Under dagens nybyggnadskrav"},
  {k:"E",  max:0.35, c:"#dd7d1c", t:"Renoveringsbehov på sikt"},
  {k:"F",  max:0.50, c:"#cf5220", t:"Svag isolering"},
  {k:"G",  max:99,   c:"#b32d2d", t:"Oisolerad eller nära nog"}
];
function renderClass(U){
  const box = $("#eclass");
  if(U===null){ box.innerHTML = '<div class="hb-hint">Fyll i λ-värden för att få en klassning.</div>'; return; }
  const idx = ESCALE.findIndex(e => U <= e.max);
  const e = ESCALE[idx];
  box.innerHTML =
    `<div class="hb-hint">Isolerklass yttervägg</div>
     <div class="escale">${ESCALE.map((x,i)=>
       `<div class="${i===idx?"on":""}" title="≤ ${x.max} W/m²K">${x.k}</div>`).join("")}</div>
     <div class="hb-klass"><b>Klass ${e.k}</b> — ${e.t}</div>
     <div class="hb-hint hb-mt-s">Egen skala för U-värdet i just den här väggen, inte en EU-energideklaration — den klassar hela byggnaden inklusive tak, fönster, ventilation och uppvärmning.</div>`;
  box.querySelectorAll(".escale div").forEach((d,i)=>{ d.style.background = ESCALE[i].c; });
  box.querySelector(".hb-klass b").style.color = e.c;
}
const fmt = n => (Math.round(n*10)/10).toString().replace(".",",");
function totalT(w){ return w.layers.reduce((a,x)=>a+ +x.t,0); }

/* ---------------- section drawing ---------------- */
function hatchDefs(){
  return `<defs>
  <pattern id="h-insul" width="12" height="12" patternUnits="userSpaceOnUse">
    <rect width="12" height="12" fill="#f7e6ae"/>
    <path d="M0 12 Q3 6 6 12 Q9 6 12 12" stroke="#caa54a" fill="none" stroke-width="1"/>
    <path d="M0 6 Q3 0 6 6 Q9 0 12 6" stroke="#caa54a" fill="none" stroke-width="1"/></pattern>
  <pattern id="h-board" width="8" height="8" patternUnits="userSpaceOnUse">
    <rect width="8" height="8" fill="#e2dbcb"/>
    <path d="M0 8 L8 0" stroke="#b6ad98" stroke-width="1"/></pattern>
  <pattern id="h-gyp" width="6" height="6" patternUnits="userSpaceOnUse">
    <rect width="6" height="6" fill="#f2efe9"/>
    <circle cx="3" cy="3" r="0.6" fill="#c8c2b6"/></pattern>
  <pattern id="h-wood" width="10" height="10" patternUnits="userSpaceOnUse">
    <rect width="10" height="10" fill="#c08b4e"/>
    <path d="M0 3 H10 M0 7 H10" stroke="#9a6c37" stroke-width="1"/></pattern>
  <pattern id="h-air" width="8" height="8" patternUnits="userSpaceOnUse">
    <rect width="8" height="8" fill="#f1f6f9"/></pattern>
  <pattern id="h-conc" width="9" height="9" patternUnits="userSpaceOnUse">
    <rect width="9" height="9" fill="#d3d3ce"/>
    <circle cx="2" cy="6" r="1" fill="#a9a9a2"/><circle cx="6" cy="2" r="1.2" fill="#a9a9a2"/></pattern>
</defs>`;
}
function fillFor(k){
  return {isol:"url(#h-insul)",stomme:"url(#h-insul)",skiva:"url(#h-board)",
    gips:"url(#h-gyp)",fasad:"url(#h-wood)",luft:"url(#h-air)",
    sparr:"#8fb8d8",betong:"url(#h-conc)"}[k] || "#ddd";
}
function drawSection(){
  const w = W(), L = w.layers, tot = totalT(w);
  const H = 300, padL = 34, padR = 250, padT = 34;
  const maxW = 560;
  const sc = maxW / Math.max(tot, 1);
  const width = padL + maxW + padR;
  let x = padL, s = "";
  const labels = [];
  L.forEach((lay,i)=>{
    const bw = Math.max(+lay.t * sc, 1.2);
    s += `<rect x="${x.toFixed(1)}" y="${padT}" width="${bw.toFixed(1)}" height="${H}" fill="${fillFor(lay.k)}" stroke="#6d675c" stroke-width="0.7"/>`;
    if(lay.k==="stomme"){
      const studPx = Math.min(bw, 45*sc);
      s += `<rect x="${x.toFixed(1)}" y="${padT}" width="${studPx.toFixed(1)}" height="${H}" fill="#c99a5c" stroke="#6d675c" stroke-width="0.7"/>`;
      s += `<rect x="${(x+bw-studPx).toFixed(1)}" y="${padT}" width="${studPx.toFixed(1)}" height="${H}" fill="#c99a5c" stroke="#6d675c" stroke-width="0.7"/>`;
    }
    labels.push({x:x+bw/2, i, lay, bw});
    x += bw;
  });
  // tick marks + leader lines to right-side legend
  let leg = "";
  labels.forEach((L2,i)=>{
    const ly = padT + 18 + i*24;
    const ax = padL + maxW + 16;
    leg += `<line x1="${L2.x.toFixed(1)}" y1="${padT}" x2="${L2.x.toFixed(1)}" y2="${padT-6}" stroke="#8a8378" stroke-width="0.8"/>`;
    leg += `<line x1="${L2.x.toFixed(1)}" y1="${padT-6}" x2="${ax-6}" y2="${ly-4}" stroke="#cfc8ba" stroke-width="0.7" stroke-dasharray="2 2"/>`;
    leg += `<text x="${ax}" y="${ly}" font-size="12" fill="#1c1a17">${escT(L2.lay.n)}</text>`;
    leg += `<text x="${ax+215}" y="${ly}" font-size="12" fill="#5b6472" text-anchor="end" font-family="ui-monospace,monospace">${fmt(L2.lay.t)}</text>`;
  });
  // dimension line
  const dy = padT + H + 26;
  let dim = `<line x1="${padL}" y1="${dy}" x2="${padL+maxW}" y2="${dy}" stroke="#1c1a17" stroke-width="1"/>
    <line x1="${padL}" y1="${dy-5}" x2="${padL}" y2="${dy+5}" stroke="#1c1a17"/>
    <line x1="${padL+maxW}" y1="${dy-5}" x2="${padL+maxW}" y2="${dy+5}" stroke="#1c1a17"/>
    <rect x="${padL+maxW/2-34}" y="${dy-11}" width="68" height="18" fill="#fff"/>
    <text x="${padL+maxW/2}" y="${dy+3}" font-size="12" text-anchor="middle" font-family="ui-monospace,monospace">${fmt(tot)} mm</text>`;
  const totalH = dy + 30;
  $("#section").innerHTML =
    `<svg id="secsvg" viewBox="0 0 ${width} ${totalH}" width="${width}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
      ${hatchDefs()}
      <text x="${padL}" y="16" font-size="11" fill="#8a8378">UTSIDA</text>
      <text x="${padL+maxW}" y="16" font-size="11" fill="#8a8378" text-anchor="end">INSIDA</text>
      ${s}${leg}${dim}</svg>`;
}
const escT = esc;

/* ---------------- library ---------------- */
function drawLib(){
  $("#lib").innerHTML = DB.walls.map((w,i)=>
    `<li class="${i===DB.active?"on":""}" data-i="${i}">
      <button type="button" class="nm" data-lib="valj">${escT(w.name)}</button>
      <span class="badge">${fmt(totalT(w))} mm</span>
      <button type="button" class="mini" data-lib="namn">Byt namn</button>
      <button type="button" class="mini danger" data-lib="bort" title="Ta bort">×</button></li>`).join("");
}
function pick(i){ DB.active=i; render(); }
function ren(i){ const n=prompt("Namn på väggtyp:",DB.walls[i].name); if(n){DB.walls[i].name=n; render();} }
function rm(i){ if(DB.walls.length<2) return alert("Minst en väggtyp måste finnas.");
  if(!confirm("Ta bort "+DB.walls[i].name+"?"))return;
  DB.walls.splice(i,1); DB.active=Math.min(DB.active,DB.walls.length-1); render(); drawPlan(); }
function newWall(){ DB.walls.push({name:"Ny väggtyp",studFrac:0.12,layers:[{n:"Gips",k:"gips",t:13,l:0.22}]});
  DB.active=DB.walls.length-1; render(); }
function dupWall(){ const c=JSON.parse(JSON.stringify(W())); c.name=c.name+" (kopia)";
  DB.walls.push(c); DB.active=DB.walls.length-1; render(); }

function copySpec(){
  const w=W();
  const txt = w.name+"\n"+"-".repeat(w.name.length)+"\n"+
    w.layers.map(l=>`${l.n.padEnd(34,".")} ${fmt(l.t)} mm`).join("\n")+
    `\n\nTotal tjocklek: ${fmt(totalT(w))} mm\nU-värde: ${$("#uval").textContent}`;
  navigator.clipboard.writeText(txt).then(()=>alert("Specifikationen är kopierad."),
    ()=>prompt("Kopiera texten:",txt));
}
function exportSVG(){ dl(new XMLSerializer().serializeToString($("#secsvg")), W().name+" snitt.svg","image/svg+xml"); }

/* ---------------- plan ---------------- */
let P = { walls:[], ops:[], pts:[] };
let tool="wall", pending=null, mouse=null, shift=false;

document.querySelectorAll(".hb-flikar button").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".hb-flikar button").forEach(x=>x.classList.remove("on"));
  b.classList.add("on");
  document.querySelectorAll(".hb-sida").forEach(p=>p.classList.remove("on"));
  $("#page-"+b.dataset.tab).classList.add("on");
  if(b.dataset.tab==="p"){ anpassaYta(); drawPlan(); }
});
function setTool(t){ tool=t; pending=null; hideAng(); hideCtx(); stopHold();
  ["wall","open","sel","tape"].forEach(k=>$("#t-"+k).classList.toggle("on",k===t));
  $("#planhint").textContent = t==="wall"
    ? "Klicka för startpunkt, klicka igen för att fortsätta. Snappar till 90° och 45°. Håll musen stilla en sekund — ringen vid korset visar när snappningen släpper — eller håll Alt för fri vinkel direkt. Högerklick avslutar väggen."
    : t==="tape" ? "Klicka på en hörnpunkt, dra åt önskat håll och klicka för att sätta en mätpunkt. Håll stilla för att skriva exakt mått. Punkten går sedan att fästa väggar mot."
    : t==="open" ? "Klicka på en vägg där öppningen ska sitta. Måtten tas från panelen till höger."
    : "Klicka på en vägg för att välja den, ta bort med Delete. Högerklick ger fler alternativ.";
  drawPlan();
}
function syncActiveWallSelect(){
  const s=$("#activeWall"), cur=s.value;
  s.innerHTML = DB.walls.map((w,i)=>`<option value="${i}">${escT(w.name)} — ${fmt(totalT(w))} mm</option>`).join("");
  s.value = cur && cur < DB.walls.length ? cur : DB.active;
}
let Z = 28, V = {ox:40, oy:40};
const SC = () => Z/1000;
const SNAP = () => +$("#snap").value;
function toWorld(e){
  const r = $("#plan").getBoundingClientRect(), s = SC();
  return { x:(e.clientX-r.left-V.ox)/s, y:(e.clientY-r.top-V.oy)/s };
}
function snapPt(p){
  const m = magnet(p); if(m) return m;
  const g=SNAP(); return {x:Math.round(p.x/g)*g, y:Math.round(p.y/g)*g};
}
function magnet(p){
  const tol = 13/SC();
  let best=null;
  const cands=[...P.pts];
  P.walls.forEach(w=>{ cands.push(w.a); cands.push(w.b); });
  cands.forEach(c=>{ const d=Math.hypot(c.x-p.x,c.y-p.y);
    if(d<tol && (!best||d<best.d)) best={x:c.x,y:c.y,d}; });
  return best ? {x:best.x,y:best.y,mag:true} : null;
}

let rawPt=null, freeAngle=false, holdTimer=null, lastSnap=null, altKey=false;

function resolveEnd(from, raw){
  const mg = magnet(raw);
  if(mg && (mg.x!==from.x||mg.y!==from.y)){
    const d=Math.hypot(mg.x-from.x,mg.y-from.y);
    return {pt:{x:mg.x,y:mg.y}, deg:Math.atan2(mg.y-from.y,mg.x-from.x)*180/Math.PI, len:d, snapped:true, mag:true};
  }
  const dx=raw.x-from.x, dy=raw.y-from.y;
  const dist=Math.hypot(dx,dy);
  if(dist<1) return {pt:{...from}, deg:0, len:0, snapped:false};
  let deg = Math.atan2(dy,dx)*180/Math.PI;
  let snapped=false;
  if(!freeAngle && !altKey){
    const n90 = Math.round(deg/90)*90;
    const n45 = Math.round(deg/45)*45;
    if(Math.abs(deg-n90) <= 9){ deg=n90; snapped=true; }
    else if(Math.abs(deg-n45) <= 5){ deg=n45; snapped=true; }
  }
  const g=SNAP();
  const len = Math.max(g, Math.round(dist/g)*g);
  const r = deg*Math.PI/180;
  return { pt:{x:from.x+Math.cos(r)*len, y:from.y+Math.sin(r)*len}, deg, len, snapped };
}
let holdT0=0, holdDur=0, holdIv=null;
function stopHold(){ clearTimeout(holdTimer); clearInterval(holdIv); holdIv=null; holdDur=0; }
function armHold(){
  stopHold();
  freeAngle=false; hideAng();
  let dur=250;
  if(pending && rawPt){
    const st=resolveEnd(pending, rawPt);
    if(st.snapped && !st.mag){
      const d=(((st.deg%360)+360)%360) % 90;
      dur = (d<0.01 || 90-d<0.01) ? 1000 : 550;
    }
  }
  holdT0=Date.now(); holdDur=dur;
  holdIv=setInterval(drawPlan, 70);
  holdTimer=setTimeout(()=>{
    stopHold();
    if(!pending) return;
    freeAngle=true;
    showAng(resolveEnd(pending, rawPt||pending));
    drawPlan();
  }, dur);
}
function showAng(s){
  const b=$("#angbox"), sc=SC();
  b.style.display="block";
  const pw=+$("#plan").getAttribute("width"), ph=+$("#plan").getAttribute("height");
  b.style.left = Math.max(4, Math.min(pw-200, V.ox+s.pt.x*sc+14))+"px";
  b.style.top  = Math.max(4, Math.min(ph-100, V.oy+s.pt.y*sc+14))+"px";
  $("#angDeg").value = Math.round(s.deg*10)/10;
  $("#angLen").value = Math.round(s.len);
}
function hideAng(){ $("#angbox").style.display="none"; }
$("#angDeg").addEventListener("keydown", angKey);
$("#angLen").addEventListener("keydown", angKey);
function angKey(e){
  if(e.key==="Enter"){
    e.preventDefault();
    const d=+$("#angDeg").value*Math.PI/180, L=+$("#angLen").value;
    if(pending && L>0){
      const q={x:pending.x+Math.cos(d)*L, y:pending.y+Math.sin(d)*L};
      if(tool==="tape"){ P.pts.push({x:q.x,y:q.y,from:{...pending},len:L}); pending=null; }
      else { P.walls.push({a:pending,b:q,w:+$("#activeWall").value,j:$("#just").value}); pending=q; }
      freeAngle=false; hideAng(); drawPlan();
    }
  }
  if(e.key==="Escape"){ freeAngle=false; hideAng(); drawPlan(); }
}

let panning=null, panMoved=false;
$("#plan").addEventListener("wheel", e=>{
  e.preventDefault();
  const r=$("#plan").getBoundingClientRect();
  const mx=e.clientX-r.left, my=e.clientY-r.top, s0=SC();
  const wx=(mx-V.ox)/s0, wy=(my-V.oy)/s0;
  Z = Math.max(2, Math.min(400, Z * (e.deltaY<0 ? 1.13 : 1/1.13)));
  const s1=SC();
  V.ox = mx - wx*s1; V.oy = my - wy*s1;
  $("#zoom").value = Math.round(Z);
  stopHold(); drawPlan();
}, {passive:false});

$("#plan").addEventListener("mousedown", e=>{
  if(e.ctrlKey || e.metaKey || e.button===1){
    e.preventDefault();
    panning={x:e.clientX, y:e.clientY, ox:V.ox, oy:V.oy};
    panMoved=false;
    $("#plan").style.cursor="grabbing";
  }
});
window.addEventListener("mousemove", e=>{
  if(!panning) return;
  V.ox = panning.ox + (e.clientX-panning.x);
  V.oy = panning.oy + (e.clientY-panning.y);
  if(Math.abs(e.clientX-panning.x)+Math.abs(e.clientY-panning.y) > 3) panMoved=true;
  drawPlan();
});
window.addEventListener("mouseup", ()=>{
  if(!panning) return;
  panning=null; $("#plan").style.cursor="none";
  setTimeout(()=>{ panMoved=false; }, 60);
});
function resetView(){ Z=28; V={ox:40,oy:40}; $("#zoom").value=28; drawPlan(); }
function fitView(){
  const all=[...P.walls.flatMap(w=>[w.a,w.b]), ...P.pts];
  if(!all.length) return resetView();
  const xs=all.map(p=>p.x), ys=all.map(p=>p.y);
  const w=Math.max(...xs)-Math.min(...xs), h=Math.max(...ys)-Math.min(...ys);
  const pw=+$("#plan").getAttribute("width"), ph=+$("#plan").getAttribute("height");
  Z = Math.max(2, Math.min(400, 1000*Math.min((pw-100)/(w||1000), (ph-80)/(h||1000))));
  const s=SC();
  V.ox = - Math.min(...xs)*s + (pw - w*s)/2;
  V.oy = - Math.min(...ys)*s + (ph - h*s)/2;
  $("#zoom").value=Math.round(Z); drawPlan();
}

$("#plan").addEventListener("mousemove", e=>{
  const w = toWorld(e);
  const moved = !rawPt || Math.hypot(w.x-rawPt.x, w.y-rawPt.y) > 25;
  rawPt = w;
  mouse = snapPt(w);
  shift = e.shiftKey; altKey = e.altKey;
  if(pending && moved) armHold();
  drawPlan();
});
$("#plan").addEventListener("mouseleave", ()=>{ rawPt=null; mouse=null; stopHold(); drawPlan(); });
$("#plan").addEventListener("click", e=>{
  if(panMoved || e.ctrlKey || e.metaKey) return;
  hideCtx();
  const p = snapPt(toWorld(e));
  if(tool==="wall"){
    if(!pending){ pending=p; armHold(); }
    else{
      const s = resolveEnd(pending, toWorld(e));
      if(s.len>0){ snap(); P.walls.push({a:pending,b:s.pt,w:+$("#activeWall").value,j:$("#just").value}); }
      pending=s.pt; freeAngle=false; hideAng(); armHold();
    }
  } else if(tool==="tape"){
    if(!pending){ pending=tapeAnchor(toWorld(e)); armHold(); }
    else{
      const s = resolveEnd(pending, toWorld(e));
      if(s.len>0){ snap(); P.pts.push({x:s.pt.x, y:s.pt.y, from:{...pending}, len:Math.round(s.len)}); }
      pending=null; freeAngle=false; hideAng(); stopHold();
    }
  } else if(tool==="open"){
    const hit = nearestWall(toWorld(e));
    if(hit){
      const bM=+$("#opB").value, hM=+$("#opH").value;
      snap(); P.ops.push({wall:hit.i, t:hit.t, type:$("#opType").value, bM, hM, sill:+$("#opS").value});
    }
  } else {
    const hit = nearestWall(toWorld(e));
    P.walls.forEach(w=>w.sel=false);
    if(hit) P.walls[hit.i].sel = true;
  }
  drawPlan();
});
$("#plan").addEventListener("contextmenu", e=>{
  e.preventDefault();
  if(pending){ pending=null; freeAngle=false; hideAng(); stopHold(); drawPlan(); return; }
  const w = toWorld(e), s=SC();
  const ri = roomAt(w);
  if(ri>=0){ showCtx(e, roomMenu(ri)); return; }
  const pi = P.pts.findIndex(p=>Math.hypot(p.x-w.x,p.y-w.y) < 14/s);
  if(pi>=0){ showCtx(e, ptMenu(pi)); return; }
  const hit = nearestWall(w);
  if(hit) showCtx(e, wallMenu(hit.i));
  else hideCtx();
});
function showCtx(e, html){
  const c=$("#ctx"), r=$("#planwrap").getBoundingClientRect();
  c.innerHTML=html; c.style.display="block";
  c.style.left = Math.min(r.width-180, e.clientX-r.left)+"px";
  c.style.top  = Math.min(r.height-40, e.clientY-r.top)+"px";
}
function hideCtx(){ $("#ctx").style.display="none"; }
document.addEventListener("click", e=>{ if(!e.target.closest("#ctx")) hideCtx(); });

function wallMenu(i){
  const w=P.walls[i];
  return `<div class="hd">Vägg · ${Math.round(len(w))} mm</div>
    <div class="it" data-ctx="matt" data-i="${i}">Ändra mått…</div>
    <div class="it" data-ctx="spegla" data-i="${i}">Spegla sida (${esc(w.j||"mid")})</div>
    <div class="it" data-ctx="ta-bort-vagg" data-i="${i}">Ta bort vägg</div>
    <hr><div class="hd">Byt väggtyp</div>
    ${DB.walls.map((x,k)=>`<div class="it" data-ctx="vaggtyp" data-i="${i}" data-k="${k}">${k===w.w?"✓ ":"　"}${escT(x.name)} · ${fmt(totalT(x))} mm</div>`).join("")}`;
}
function roomMenu(i){
  const r=computeAreas().rooms[i];
  return `<div class="hd">${escT(roomName(r,i))} · ${fm2(r.m2)}</div>
    <div class="it" data-ctx="rumsnamn" data-i="${i}">Byt namn…</div>
    <div class="it" data-ctx="standardnamn" data-i="${i}">Återställ till standardnamn</div>`;
}
function ptMenu(i){
  const p=P.pts[i];
  return `<div class="hd">Mätpunkt${p.len?" · "+esc(p.len)+" mm":""}</div>
    <div class="it" data-ctx="ta-bort-punkt" data-i="${i}">Ta bort punkt</div>
    <div class="it" data-ctx="rensa-punkter">Rensa alla mätpunkter</div>`;
}
$("#ctx").addEventListener("click", e=>{
  const it=e.target.closest("[data-ctx]"); if(!it) return;
  const i=+it.dataset.i, vad=it.dataset.ctx;
  if(vad==="matt") return editLen(i);
  if(vad==="spegla") return flipJ(i);
  if(vad==="rumsnamn") return renameRoom(i);
  snap();
  if(vad==="ta-bort-vagg"){ P.walls.splice(i,1); P.ops=P.ops.filter(o=>o.wall!==i).map(o=>({...o, wall:o.wall>i?o.wall-1:o.wall})); }
  if(vad==="vaggtyp") P.walls[i].w=+it.dataset.k;
  if(vad==="standardnamn"){ const r=computeAreas().rooms[i]; if(r) P.names=(P.names||[]).filter(n=>Math.hypot(n.x-r.x,n.y-r.y)>=2500); }
  if(vad==="ta-bort-punkt") P.pts.splice(i,1);
  if(vad==="rensa-punkter") P.pts=[];
  hideCtx(); drawPlan();
});
function editLen(i){
  hideCtx();
  const w=P.walls[i], cur=Math.round(len(w));
  const v=prompt("Väggens längd i mm:", cur);
  if(!v) return;
  const L=+v; if(!(L>0)) return;
  snap();
  const a=Math.atan2(w.b.y-w.a.y, w.b.x-w.a.x);
  w.b={x:w.a.x+Math.cos(a)*L, y:w.a.y+Math.sin(a)*L};
  drawPlan();
}
function flipJ(i){
  snap();
  const w=P.walls[i], order=["left","mid","right"];
  w.j = order[(order.indexOf(w.j||"mid")+1)%3];
  hideCtx(); drawPlan();
}
document.addEventListener("keydown", e=>{
  if(!$("#page-p").classList.contains("on")) return;
  if(e.target.isContentEditable || /input|select|textarea/i.test(e.target.tagName)) return;
  const mod = e.ctrlKey || e.metaKey;
  if(mod && (e.key==="z"||e.key==="Z")){ e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if(mod && (e.key==="y"||e.key==="Y")){ e.preventDefault(); redo(); return; }
  if(/input|select/i.test(e.target.tagName)) return;
  if(e.key==="Escape"){ pending=null; freeAngle=false; hideAng(); hideCtx(); stopHold(); drawPlan(); }
  if(e.key==="j"||e.key==="J"){ if(P.walls.length) flipJ(P.walls.length-1); }
  if(e.key==="Delete"||e.key==="Backspace"){
    const idx = P.walls.findIndex(w=>w.sel);
    if(idx>=0 && tool==="sel"){ snap(); P.walls.splice(idx,1); P.ops=P.ops.filter(o=>o.wall!==idx)
      .map(o=>({...o, wall:o.wall>idx?o.wall-1:o.wall})); drawPlan(); }
  }
});
let hist=[], fut=[];
function snap(){ hist.push(JSON.stringify(P)); if(hist.length>80) hist.shift(); fut=[]; }
function undo(){
  if(pending){ pending=null; freeAngle=false; hideAng(); drawPlan(); return; }
  if(!hist.length) return;
  fut.push(JSON.stringify(P));
  P=JSON.parse(hist.pop()); normalize(); drawPlan();
}
function redo(){
  if(!fut.length) return;
  hist.push(JSON.stringify(P));
  P=JSON.parse(fut.pop()); normalize(); drawPlan();
}
function clearPlan(){
  if(!confirm("Rensa hela planen? Väggar, öppningar och mätpunkter tas bort. Dina väggtyper påverkas inte.")) return;
  snap();
  P.walls=[]; P.ops=[]; P.pts=[];
  pending=null; hideAng(); hideCtx(); drawPlan();
}
function nearestWall(p){
  let best=null;
  P.walls.forEach((w,i)=>{
    const dx=w.b.x-w.a.x, dy=w.b.y-w.a.y, L2=dx*dx+dy*dy || 1;
    let t=((p.x-w.a.x)*dx+(p.y-w.a.y)*dy)/L2; t=Math.max(0,Math.min(1,t));
    const cx=w.a.x+t*dx, cy=w.a.y+t*dy;
    const d=Math.hypot(p.x-cx,p.y-cy);
    if(d<400 && (!best||d<best.d)) best={i,t,d};
  });
  return best;
}
function wallOffsets(w){
  const th = totalT(DB.walls[w.w] || DB.walls[0]);
  const j = w.j || "mid";
  const o1 = j==="mid" ? -th/2 : j==="left" ? -th : 0;
  return {o1, o2:o1+th, th};
}
function wallRefPoint(i, t, ref){
  const w = P.walls[i], o = wallOffsets(w);
  const ang = Math.atan2(w.b.y-w.a.y, w.b.x-w.a.x);
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  const d = ref==="left" ? o.o1 : ref==="right" ? o.o2 : (o.o1+o.o2)/2;
  return { x: w.a.x+(w.b.x-w.a.x)*t + nx*d, y: w.a.y+(w.b.y-w.a.y)*t + ny*d };
}
function tapeAnchor(world){
  const hit = nearestWall(world);
  if(hit && hit.d < 600) return wallRefPoint(hit.i, hit.t, $("#tapeRef").value);
  return snapPt(world);
}
function near(p,q){ return Math.abs(p.x-q.x)<1 && Math.abs(p.y-q.y)<1; }
function lineOf(w, side){
  const o = wallOffsets(w);
  const ang = Math.atan2(w.b.y-w.a.y, w.b.x-w.a.x);
  const nx=-Math.sin(ang), ny=Math.cos(ang);
  const d = side ? o.o2 : o.o1;
  return { p:{x:w.a.x+nx*d, y:w.a.y+ny*d}, q:{x:w.b.x+nx*d, y:w.b.y+ny*d} };
}
function isect(l1,l2){
  const x1=l1.p.x,y1=l1.p.y,x2=l1.q.x,y2=l1.q.y,x3=l2.p.x,y3=l2.p.y,x4=l2.q.x,y4=l2.q.y;
  const den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
  if(Math.abs(den)<1e-7) return null;
  const a=x1*y2-y1*x2, b=x3*y4-y3*x4;
  return { x:(a*(x3-x4)-(x1-x2)*b)/den, y:(a*(y3-y4)-(y1-y2)*b)/den };
}
function neighbourAt(i, end){
  const w=P.walls[i], pt = end==="a" ? w.a : w.b;
  for(let k=0;k<P.walls.length;k++){
    if(k===i) continue;
    const o=P.walls[k];
    if(end==="b"){
      if(near(o.a,pt)) return {k, flip:false};
      if(near(o.b,pt)) return {k, flip:true};
    }else{
      if(near(o.b,pt)) return {k, flip:false};
      if(near(o.a,pt)) return {k, flip:true};
    }
  }
  return null;
}
function cornerPts(i){
  const w=P.walls[i];
  const L=[lineOf(w,0), lineOf(w,1)];
  const out={};
  ["a","b"].forEach(end=>{
    const nb = neighbourAt(i,end);
    [0,1].forEach(sd=>{
      const base = end==="a" ? L[sd].p : L[sd].q;
      if(!nb){ out[end+sd]=base; return; }
      const other = lineOf(P.walls[nb.k], nb.flip ? 1-sd : sd);
      const X = isect(L[sd], other);
      const lim = Math.max(600, wallOffsets(w).th*4);
      out[end+sd] = (X && Math.hypot(X.x-base.x, X.y-base.y) < lim) ? X : base;
    });
  });
  return { a0:out.a0, b0:out.b0, b1:out.b1, a1:out.a1,
           jointA: !!neighbourAt(i,"a"), jointB: !!neighbourAt(i,"b") };
}
function len(w){ return Math.hypot(w.b.x-w.a.x, w.b.y-w.a.y); }

function drawPlan(){
  syncActiveWallSelect();
  const svg=$("#plan"), s=SC(), OX=V.ox, OY=V.oy;
  const W_=+svg.getAttribute("width"), H_=+svg.getAttribute("height");
  let g="";
  const drafting = $("#draft").checked;
  const gs=1000*s;
  if(!drafting){
  const gx=((OX%gs)+gs)%gs, gy=((OY%gs)+gs)%gs;
  for(let x=gx;x<W_;x+=gs) g+=`<line x1="${x}" y1="0" x2="${x}" y2="${H_}" stroke="#e7ebf1" stroke-width="1"/>`;
  for(let y=gy;y<H_;y+=gs) g+=`<line x1="0" y1="${y}" x2="${W_}" y2="${y}" stroke="#e7ebf1" stroke-width="1"/>`;
  }

  let body="", dims="";
  P.walls.forEach((w,i)=>{
    const wt = DB.walls[w.w] || DB.walls[0];
    const th = totalT(wt)*s;
    const ax=OX+w.a.x*s, ay=OY+w.a.y*s, bx=OX+w.b.x*s, by=OY+w.b.y*s;
    const ang=Math.atan2(by-ay,bx-ax), ux=-Math.sin(ang), uy=Math.cos(ang);
    const off = wallOffsets(w);
    const o1 = off.o1*s, o2 = off.o2*s;
    const nx=ux*th/2, ny=uy*th/2;
    const C = cornerPts(i);
    const px = p => (OX+p.x*s).toFixed(1)+","+(OY+p.y*s).toFixed(1);
    const X = p => (OX+p.x*s).toFixed(1), Y = p => (OY+p.y*s).toFixed(1);
    const pts=[C.a0,C.b0,C.b1,C.a1].map(px).join(" ");
    const ec = w.sel?"#2A4B7C":(drafting?"#000":"#5b6472");
    const edge=(p,q)=>`<line x1="${X(p)}" y1="${Y(p)}" x2="${X(q)}" y2="${Y(q)}" stroke="${ec}" stroke-width="${drafting?1:1.2}"/>`;
    body+=`<polygon points="${pts}" fill="${w.sel?"#d6e2f1":(drafting?"#fff":"#dfe3ea")}" stroke="none"/>`;
    body+=edge(C.a0,C.b0)+edge(C.a1,C.b1);
    if(!C.jointA) body+=edge(C.a0,C.a1);
    if(!C.jointB) body+=edge(C.b0,C.b1);
    // openings on this wall
    const mox = ux*(o1+o2)/2, moy = uy*(o1+o2)/2;
    P.ops.filter(o=>o.wall===i).forEach(o=>{
      const bw=(o.bM*100-10)*s;
      const cx=ax+(bx-ax)*o.t+mox, cy=ay+(by-ay)*o.t+moy;
      const ux=Math.cos(ang), uy=Math.sin(ang);
      const p1=[cx-ux*bw/2+nx,cy-uy*bw/2+ny], p2=[cx+ux*bw/2+nx,cy+uy*bw/2+ny],
            p3=[cx+ux*bw/2-nx,cy+uy*bw/2-ny], p4=[cx-ux*bw/2-nx,cy-uy*bw/2-ny];
      body+=`<polygon points="${[p1,p2,p3,p4].map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ")}" fill="#fff" stroke="#2A4B7C" stroke-width="1.2"/>`;
      if(o.type==="F"){
        body+=`<line x1="${((p1[0]+p4[0])/2).toFixed(1)}" y1="${((p1[1]+p4[1])/2).toFixed(1)}" x2="${((p2[0]+p3[0])/2).toFixed(1)}" y2="${((p2[1]+p3[1])/2).toFixed(1)}" stroke="#2A4B7C" stroke-width="1.4"/>`;
      }else{
        body+=`<path d="M ${p4[0].toFixed(1)} ${p4[1].toFixed(1)} A ${bw.toFixed(1)} ${bw.toFixed(1)} 0 0 1 ${(p4[0]+ (-uy)*bw).toFixed(1)} ${(p4[1]+ux*bw).toFixed(1)}" fill="none" stroke="#2A4B7C" stroke-width="1" stroke-dasharray="3 2"/>`;
      }
      body+=`<text x="${cx.toFixed(1)}" y="${(cy-th/2-6).toFixed(1)}" font-size="10" text-anchor="middle" fill="${drafting?"#000":"#2A4B7C"}">${drafting?o.bM+"x"+o.hM:o.type+" "+o.bM+"×"+o.hM}</text>`;
    });
    // dimension
    const dof=th/2+16, mx=(ax+bx)/2 - Math.sin(ang)*dof, my=(ay+by)/2 + Math.cos(ang)*dof;
    const L=Math.round(len(w));
    if(!drafting) dims+=`<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" font-size="11" text-anchor="middle" fill="#5b6472" font-family="ui-monospace,monospace" transform="rotate(${(ang*180/Math.PI+ (Math.abs(ang)>Math.PI/2?180:0)).toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)})">${L}</text>`;
  });

  let marks="";
  const showA = $("#showArea").checked, draft = $("#draft").checked;
  computeAreas().rooms.forEach((r,i)=>{
    const rx=OX+r.x*s, ry=OY+r.y*s;
    if(rx<-40||ry<-40||rx>W_+40||ry>H_+40) return;
    const nm=escT(roomName(r,i));
    if(showA){
      marks+=`<text x="${rx.toFixed(1)}" y="${(ry-2).toFixed(1)}" font-size="12.5" fill="#1c1a17" text-anchor="middle">${nm}</text>
        <text x="${rx.toFixed(1)}" y="${(ry+14).toFixed(1)}" font-size="12.5" fill="#1c1a17" text-anchor="middle">${fm2(r.m2)}</text>`;
    }else{
      marks+=`<text x="${rx.toFixed(1)}" y="${(ry+5).toFixed(1)}" font-size="12.5" fill="#1c1a17" text-anchor="middle">${nm}</text>`;
    }
  });
  P.pts.forEach(p=>{
    const px=OX+p.x*s, py=OY+p.y*s;
    if(p.from){
      const fx=OX+p.from.x*s, fy=OY+p.from.y*s;
      marks+=`<line x1="${fx.toFixed(1)}" y1="${fy.toFixed(1)}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#9a5a1a" stroke-width="1" stroke-dasharray="4 3"/>
        <text x="${((fx+px)/2).toFixed(1)}" y="${((fy+py)/2-5).toFixed(1)}" font-size="10.5" fill="#9a5a1a" text-anchor="middle" font-family="ui-monospace,monospace">${p.len}</text>`;
    }
    marks+=`<line x1="${(px-6).toFixed(1)}" y1="${py.toFixed(1)}" x2="${(px+6).toFixed(1)}" y2="${py.toFixed(1)}" stroke="#9a5a1a" stroke-width="1.6"/>
      <line x1="${px.toFixed(1)}" y1="${(py-6).toFixed(1)}" x2="${px.toFixed(1)}" y2="${(py+6).toFixed(1)}" stroke="#9a5a1a" stroke-width="1.6"/>`;
  });

  let ghost="", cx=null, cy=null;
  if(pending && rawPt && (tool==="wall"||tool==="tape")){
    const st = resolveEnd(pending, rawPt);
    const tape = tool==="tape";
    const x1=OX+pending.x*s, y1=OY+pending.y*s, x2=OX+st.pt.x*s, y2=OY+st.pt.y*s;
    const col = tape ? "#9a5a1a" : st.snapped ? "#2A4B7C" : (freeAngle||altKey ? "#9a5a1a" : "#8a8378");
    ghost=`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="2" stroke-dasharray="5 4"/>
      <circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="3.5" fill="${col}"/>`;
    if(st.snapped){
      const r=26, a0=0, a1=st.deg*Math.PI/180;
      ghost+=`<path d="M ${(x1+r).toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${Math.abs(st.deg)>180?1:0} ${st.deg>0?1:0} ${(x1+Math.cos(a1)*r).toFixed(1)} ${(y1+Math.sin(a1)*r).toFixed(1)}" fill="none" stroke="#2A4B7C" stroke-width="1"/>`;
    }
    const mx=(x1+x2)/2, my=(y1+y2)/2;
    const deg = ((Math.round(st.deg*10)/10)%360+360)%360;
    ghost+=`<rect x="${(mx-52).toFixed(1)}" y="${(my-26).toFixed(1)}" width="104" height="19" rx="3" fill="#fff" stroke="${col}" stroke-width="0.7"/>
      <text x="${mx.toFixed(1)}" y="${(my-12.5).toFixed(1)}" font-size="11.5" fill="#1c1a17" text-anchor="middle" font-family="ui-monospace,monospace">${Math.round(st.len)} mm · ${deg}°</text>`;
    cx=x2; cy=y2;
  } else if(mouse){ cx=OX+mouse.x*s; cy=OY+mouse.y*s; }

  if(tool==="tape" && !pending && rawPt){
    const a = tapeAnchor(rawPt);
    const ax2=OX+a.x*s, ay2=OY+a.y*s;
    marks+=`<circle cx="${ax2.toFixed(1)}" cy="${ay2.toFixed(1)}" r="5" fill="none" stroke="#9a5a1a" stroke-width="1.8"/>`;
  }

  let cross="";
  if(cx!==null){
    if(holdDur>0 && pending){
      const f = Math.min(1,(Date.now()-holdT0)/holdDur), R=15, C=2*Math.PI*R;
      cross+=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${R}" fill="none" stroke="#e5e0d5" stroke-width="2.5"/>
        <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${R}" fill="none" stroke="#9a5a1a" stroke-width="2.5"
          stroke-dasharray="${(f*C).toFixed(1)} ${C.toFixed(1)}" stroke-linecap="round"
          transform="rotate(-90 ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`;
    }
    cross=`<line x1="${cx.toFixed(1)}" y1="0" x2="${cx.toFixed(1)}" y2="${H_}" stroke="#1c1a17" stroke-width="0.6" opacity="0.35"/>
      <line x1="0" y1="${cy.toFixed(1)}" x2="${W_}" y2="${cy.toFixed(1)}" stroke="#1c1a17" stroke-width="0.6" opacity="0.35"/>
      <line x1="${(cx-11).toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(cx+11).toFixed(1)}" y2="${cy.toFixed(1)}" stroke="#000" stroke-width="1.6"/>
      <line x1="${cx.toFixed(1)}" y1="${(cy-11).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(cy+11).toFixed(1)}" stroke="#000" stroke-width="1.6"/>
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.2" fill="none" stroke="#000" stroke-width="1.4"/>`;
  }
  const frame = drafting ? draftFrame(OX,OY,s,W_,H_) : "";
  svg.innerHTML = g+body+dims+marks+frame+ghost+cross;
  stats();
}
let areaCache={sig:"",rooms:[],foot:0,inner:0};
function computeAreas(){
  const sig = JSON.stringify(P.walls);
  if(sig===areaCache.sig) return areaCache;
  const out={sig, rooms:[], foot:0, inner:0};
  if(P.walls.length<3){ areaCache=out; return out; }

  const polys = P.walls.map((w,i)=>{ const c=cornerPts(i); return [c.a0,c.b0,c.b1,c.a1]; });
  const xs=[], ys=[];
  polys.forEach(p=>p.forEach(q=>{ xs.push(q.x); ys.push(q.y); }));
  const pad=600;
  const minx=Math.min(...xs)-pad, miny=Math.min(...ys)-pad;
  const maxx=Math.max(...xs)+pad, maxy=Math.max(...ys)+pad;
  const cell=Math.max(maxx-minx, maxy-miny)/560;
  const W=Math.max(8,Math.ceil((maxx-minx)/cell)), H=Math.max(8,Math.ceil((maxy-miny)/cell));

  const cv=document.createElement("canvas"); cv.width=W; cv.height=H;
  const ctx=cv.getContext("2d");
  ctx.fillStyle="#000"; ctx.strokeStyle="#000"; ctx.lineWidth=0.5; ctx.lineJoin="round";
  polys.forEach(p=>{
    ctx.beginPath();
    p.forEach((q,k)=>{ const X=(q.x-minx)/cell, Y=(q.y-miny)/cell; k?ctx.lineTo(X,Y):ctx.moveTo(X,Y); });
    ctx.closePath(); ctx.fill(); ctx.stroke();
  });

  const d=ctx.getImageData(0,0,W,H).data;
  const wall=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++) wall[i] = d[i*4+3]>100 ? 1 : 0;

  const lab=new Int32Array(W*H);
  const stack=[];
  const seed=(x,y)=>{ const i=y*W+x; if(!wall[i] && !lab[i]){ lab[i]=-1; stack.push(i); } };
  for(let x=0;x<W;x++){ seed(x,0); seed(x,H-1); }
  for(let y=0;y<H;y++){ seed(0,y); seed(W-1,y); }
  let ext=0;
  const nb=(i,x,y,v)=>{
    if(x>0){const j=i-1; if(!wall[j]&&!lab[j]){lab[j]=v;stack.push(j);} }
    if(x<W-1){const j=i+1; if(!wall[j]&&!lab[j]){lab[j]=v;stack.push(j);} }
    if(y>0){const j=i-W; if(!wall[j]&&!lab[j]){lab[j]=v;stack.push(j);} }
    if(y<H-1){const j=i+W; if(!wall[j]&&!lab[j]){lab[j]=v;stack.push(j);} }
  };
  while(stack.length){ const i=stack.pop(); ext++; nb(i, i%W, (i/W)|0, -1); }

  let id=0; const acc=[];
  for(let i0=0;i0<W*H;i0++){
    if(wall[i0]||lab[i0]) continue;
    id++; lab[i0]=id; stack.push(i0);
    let n=0, sx=0, sy=0;
    while(stack.length){
      const i=stack.pop(); n++; sx+=i%W; sy+=(i/W)|0;
      nb(i, i%W, (i/W)|0, id);
    }
    acc[id]={n, cx:sx/n, cy:sy/n, bx:sx/n, by:sy/n, bd:Infinity};
  }
  for(let i=0;i<W*H;i++){
    const k=lab[i]; if(k<=0||!acc[k]) continue;
    const x=i%W, y=(i/W)|0;
    const dd=(x-acc[k].cx)**2+(y-acc[k].cy)**2;
    if(dd<acc[k].bd){ acc[k].bd=dd; acc[k].bx=x; acc[k].by=y; }
  }

  const a1=cell*cell/1e6;
  out.foot=(W*H-ext)*a1;
  acc.forEach(r=>{
    if(!r) return;
    const area=r.n*a1;
    if(area<0.4) return;
    out.rooms.push({ m2:area, x:minx+r.bx*cell, y:miny+r.by*cell });
  });
  out.rooms.sort((a,b)=>b.m2-a.m2);
  out.inner=out.rooms.reduce((s,r)=>s+r.m2,0);
  areaCache=out; return out;
}
function roomName(r, i){
  let best=null;
  (P.names||[]).forEach(n=>{ const d=Math.hypot(n.x-r.x, n.y-r.y);
    if(d<2500 && (!best||d<best.d)) best={n,d}; });
  return best ? best.n.name : "Rum "+(i+1);
}
function renameRoom(i){
  hideCtx();
  const r = computeAreas().rooms[i]; if(!r) return;
  const v = prompt("Rummets namn:", roomName(r,i));
  if(v===null) return;
  snap();
  P.names = (P.names||[]).filter(n=>Math.hypot(n.x-r.x, n.y-r.y) >= 2500);
  if(v.trim()) P.names.push({x:r.x, y:r.y, name:v.trim()});
  drawPlan();
}
function roomAt(world){
  const s=SC(), rooms=computeAreas().rooms;
  for(let i=0;i<rooms.length;i++){
    const r=rooms[i];
    if(Math.hypot((r.x-world.x)*s, (r.y-world.y)*s) < 62) return i;
  }
  return -1;
}
const fm2 = v => v.toFixed(1).replace(".",",")+" m²";

function draftFrame(OX,OY,s,W_,H_){
  if(!P.walls.length) return "";
  const pts=[];
  P.walls.forEach((w,i)=>{ const c=cornerPts(i); pts.push(c.a0,c.b0,c.b1,c.a1); });
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  const x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys);
  const X0=OX+x0*s, X1=OX+x1*s, Y0=OY+y0*s, Y1=OY+y1*s;
  const dy=Math.max(22, Y0-40), dx=Math.max(24, X0-44);
  const tick=(x,y,v)=>`<line x1="${(x-4).toFixed(1)}" y1="${(y+4).toFixed(1)}" x2="${(x+4).toFixed(1)}" y2="${(y-4).toFixed(1)}" stroke="#000" stroke-width="1"/>`;
  let o="";
  o+=`<line x1="${X0}" y1="${Y0}" x2="${X0}" y2="${dy-8}" stroke="#000" stroke-width="0.5"/>
      <line x1="${X1}" y1="${Y0}" x2="${X1}" y2="${dy-8}" stroke="#000" stroke-width="0.5"/>
      <line x1="${X0}" y1="${dy}" x2="${X1}" y2="${dy}" stroke="#000" stroke-width="0.9"/>
      ${tick(X0,dy)}${tick(X1,dy)}
      <text x="${((X0+X1)/2).toFixed(1)}" y="${(dy-7).toFixed(1)}" font-size="12" text-anchor="middle" fill="#000">${Math.round(x1-x0)}</text>`;
  o+=`<line x1="${X0}" y1="${Y0}" x2="${dx-8}" y2="${Y0}" stroke="#000" stroke-width="0.5"/>
      <line x1="${X0}" y1="${Y1}" x2="${dx-8}" y2="${Y1}" stroke="#000" stroke-width="0.5"/>
      <line x1="${dx}" y1="${Y0}" x2="${dx}" y2="${Y1}" stroke="#000" stroke-width="0.9"/>
      ${tick(dx,Y0)}${tick(dx,Y1)}
      <text x="${(dx-7).toFixed(1)}" y="${((Y0+Y1)/2).toFixed(1)}" font-size="12" text-anchor="middle" fill="#000"
        transform="rotate(-90 ${(dx-7).toFixed(1)} ${((Y0+Y1)/2).toFixed(1)})">${Math.round(y1-y0)}</text>`;
  const ratio = Math.round(1/(s*0.2646)/5)*5;
  o+=`<circle cx="24" cy="${H_-26}" r="11" fill="none" stroke="#000" stroke-width="1"/>
      <text x="24" y="${H_-22}" font-size="12" text-anchor="middle" fill="#000">1</text>
      <text x="46" y="${H_-32}" font-size="16" fill="#000">Ny markplan</text>
      <line x1="46" y1="${H_-25}" x2="240" y2="${H_-25}" stroke="#000" stroke-width="1"/>
      <text x="56" y="${H_-11}" font-size="11" fill="#000">1 : ${ratio}</text>`;
  return o;
}
function stats(){
  const tot = P.walls.reduce((a,w)=>a+len(w),0);
  $("#nWalls").textContent = P.walls.length;
  $("#mWalls").textContent = (tot/1000).toFixed(2).replace(".",",")+" m";
  $("#nOps").textContent = P.ops.length;
  const A = computeAreas();
  $("#aOuter").textContent = A.foot ? fm2(A.foot) : "—";
  $("#aInner").textContent = A.inner ? fm2(A.inner) : "—";
  $("#aWallArea").textContent = A.foot ? fm2(Math.max(0,A.foot-A.inner)) : "—";
  $("#roomList").innerHTML = A.rooms.length
    ? A.rooms.map((r,i)=>`<div class="hb-stat"><span>${escT(roomName(r,i))}</span><b>${fm2(r.m2)}</b></div>`).join("")
    : '<div class="hb-hint">Slut en yta med väggar så räknas rummen automatiskt.</div>';
  $("#opList").innerHTML = P.ops.length ? P.ops.map((o,i)=>{
    const b=o.bM*100-10, h=o.hM*100-10;
    return `<div class="hb-op">${o.type==="F"?"Fönster":"Dörr"} ${o.bM}×${o.hM} M
      <span class="badge">karm ${b}×${h} mm${o.type==="F"?" · bröstning "+o.sill+" mm":""}</span>
      <button type="button" class="mini danger hb-hoger" data-op="${i}" title="Ta bort">×</button></div>`;
  }).join("") : "Inga öppningar än.";
}
function opPreview(){
  const b=+$("#opB").value*100-10, h=+$("#opH").value*100-10;
  $("#opInfo").textContent = `Karmyttermått ${b} × ${h} mm`;
}
opPreview();
function exportPlan(){ const p=$("#plan"); dl(`<svg xmlns="http://www.w3.org/2000/svg" width="${p.getAttribute("width")}" height="${p.getAttribute("height")}">${p.innerHTML}</svg>`,"planritning.svg","image/svg+xml"); }

/* ---------------- persistence ---------------- */
function normalize(){
  if(!P || typeof P!=="object") P={};
  P.walls = Array.isArray(P.walls) ? P.walls : [];
  P.ops   = Array.isArray(P.ops)   ? P.ops   : [];
  P.pts   = Array.isArray(P.pts)   ? P.pts   : [];
  P.names = Array.isArray(P.names) ? P.names : [];
  if(!DB || !Array.isArray(DB.walls) || !DB.walls.length) DB={walls:[defaultWall(),innerWall()],active:0};
  DB.active = Math.min(DB.active||0, DB.walls.length-1);
  DB.walls.forEach(w=>{ w.layers = Array.isArray(w.layers)?w.layers:[]; });
  P.walls.forEach(w=>{ if(w.w==null||w.w>=DB.walls.length) w.w=0; if(!w.j) w.j="mid"; });
}
function dl(txt,name,mime){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([txt],{type:mime}));
  a.download=name; a.click(); URL.revokeObjectURL(a.href);
}
function saveFile(){ dl(JSON.stringify({DB,P},null,1),"husprojekt.json","application/json"); }
function loadFile(inp){
  const f=inp.files[0]; if(!f)return;
  const r=new FileReader();
  r.onload=()=>{ try{ const d=JSON.parse(r.result);
    if(d.DB) DB=d.DB; if(d.P) P=d.P; normalize(); render(); drawPlan();
  }catch(err){ alert("Kunde inte läsa filen."); } };
  r.readAsText(f); inp.value="";
}
function resetAll(){
  if(!confirm("Nollställ allt och börja om från standardväggarna?")) return;
  try{ localStorage.removeItem("husbyggare"); }catch(e){}
  DB={walls:[defaultWall(),innerWall()],active:0}; P={walls:[],ops:[],pts:[]};
  normalize(); render(); drawPlan();
}
try{ const s=localStorage.getItem("husbyggare");
  if(s){ const d=JSON.parse(s); if(d.DB)DB=d.DB; if(d.P)P=d.P; } }catch(e){}
normalize();
setInterval(()=>{ try{ localStorage.setItem("husbyggare",JSON.stringify({DB,P})); }catch(e){} },4000);

/* ---------------- knappar och fält ---------------- */
const tbody = $("#layers tbody");
tbody.addEventListener("input", e=>{
  const f=e.target.dataset.f; if(!f) return;
  const i=+e.target.closest("tr").dataset.i;
  setL(i, f, f==="n"||f==="k" ? e.target.value : +e.target.value);
  if(f==="n"||f==="k") drawLib();
});
tbody.addEventListener("click", e=>{
  const b=e.target.closest("[data-skikt]"); if(!b) return;
  const i=+b.closest("tr").dataset.i;
  ({upp:()=>mv(i,-1), ner:()=>mv(i,1), bort:()=>del(i)})[b.dataset.skikt]();
});
$("#lib").addEventListener("click", e=>{
  const b=e.target.closest("[data-lib]"); if(!b) return;
  const i=+b.closest("li").dataset.i;
  ({valj:()=>pick(i), namn:()=>ren(i), bort:()=>rm(i)})[b.dataset.lib]();
});
$("#opList").addEventListener("click", e=>{
  const b=e.target.closest("[data-op]"); if(!b) return;
  snap(); P.ops.splice(+b.dataset.op,1); drawPlan();
});
const GOR = {
  "spara-fil": saveFile, "oppna-fil": ()=>$("#imp").click(), "nollstall": resetAll,
  "nytt-skikt": addLayer, "kopiera-spec": copySpec, "exportera-snitt": exportSVG,
  "ny-vagg": newWall, "duplicera": dupWall,
  "angra": undo, "gor-om": redo, "rensa": clearPlan, "anpassa": fitView, "exportera-plan": exportPlan
};
document.querySelectorAll(".hb [data-gor]").forEach(b=>b.addEventListener("click", ()=>GOR[b.dataset.gor]()));
document.querySelectorAll(".hb [data-verktyg]").forEach(b=>b.addEventListener("click", ()=>setTool(b.dataset.verktyg)));
$("#imp").addEventListener("change", e=>loadFile(e.target));
$("#preset").addEventListener("change", e=>addPreset(e.target));
$("#studmode").addEventListener("change", render);
for (const id of ["#snap","#activeWall","#just","#tapeRef","#showArea","#draft"]) $(id).addEventListener("change", ()=>drawPlan());
$("#zoom").addEventListener("input", e=>{ Z=+e.target.value; drawPlan(); });
$("#opType").addEventListener("change", opPreview);
$("#opB").addEventListener("input", opPreview);
$("#opH").addEventListener("input", opPreview);

/* ritytan följer sidans bredd */
function anpassaYta(){
  const svg=$("#plan"), b=Math.floor($("#planwrap").clientWidth);
  if(!b || +svg.getAttribute("width")===b) return;
  svg.setAttribute("width", b);
  svg.setAttribute("height", Math.round(Math.min(680, Math.max(380, b*0.68))));
  drawPlan();
}
new ResizeObserver(anpassaYta).observe($("#planwrap"));

render(); drawPlan();
})();
