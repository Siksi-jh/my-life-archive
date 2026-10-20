
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function api(path){const b=(window.SITE_CONFIG.apiBase||"").replace(/\/$/,""); return b ? b+path : ""}

function renderTimeline(){
  const wrap=document.querySelector("#timeline"); if(!wrap) return;
  const cfg=SITE_CONFIG, now=new Date().getFullYear();
  const current=Math.max(cfg.startYear,Math.min(now,cfg.endYear));
  const currentAge=cfg.startAge+(current-cfg.startYear);
  const groups={};
  for(let y=cfg.startYear;y<=cfg.endYear;y++){
    const age=cfg.startAge+(y-cfg.startYear);
    const decade=Math.floor(age/10)*10;
    (groups[decade]??=[]).push({y,age});
  }
  const decadeKeys=Object.keys(groups).map(Number).sort((a,b)=>a-b);
  const activeDecade=Math.floor(currentAge/10)*10;
  wrap.innerHTML=`
    <div class="current-year">
      <div>
        <strong>${current}</strong> <span class="age">· ${currentAge}세</span>
        <div class="desc">현재 기록 중인 해입니다.</div>
      </div>
      <a class="cta" href="diary.html?year=${current}">기록 보기</a>
    </div>
    <div class="decade-tabs">
      ${decadeKeys.map(d=>`<button class="${d===activeDecade?'active':''}" data-d="${d}">${d}대</button>`).join("")}
    </div>
    ${decadeKeys.map(d=>`
      <div class="decade-panel ${d===activeDecade?'active':''}" data-panel="${d}">
        <div class="years">
          ${groups[d].map(o=>`
            <a class="year ${o.y===current?'current':''} ${o.y>now?'future':''}" href="diary.html?year=${o.y}">
              <strong>${o.y} · ${o.age}세</strong>
              <span>${o.y>now?'기록 예정':o.y===current?'기록 중':'기록 보기'}</span>
            </a>`).join("")}
        </div>
      </div>`).join("")}`;
  wrap.querySelectorAll(".decade-tabs button").forEach(btn=>btn.onclick=()=>{
    wrap.querySelectorAll(".decade-tabs button").forEach(x=>x.classList.remove("active"));
    wrap.querySelectorAll(".decade-panel").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    wrap.querySelector(`[data-panel="${btn.dataset.d}"]`).classList.add("active");
  });
}

async function loadLatest(){
  const el=document.querySelector("#latest-posts"); if(!el) return;
  if(!SITE_CONFIG.apiBase){
    el.innerHTML=[
      ["DIARY","2026-10-20","첫 기록"],
      ["TRAVEL","2026-10-18","여행 기록은 여기부터"],
      ["CAR","2026-10-15","자동차 기록"]
    ].map(x=>`<article class="post-card"><div class="post-thumb"></div><div class="post-body"><div class="meta">${x[0]} · ${x[1]}</div><h3>${x[2]}</h3></div></article>`).join("");
    return;
  }
  try{
    const r=await fetch(api("/api/posts?limit=6")); const data=await r.json();
    if(!Array.isArray(data.posts)||!data.posts.length){el.innerHTML='<div class="empty">아직 작성된 글이 없습니다.</div>';return}
    el.innerHTML=data.posts.map(p=>`
      <a class="post-card" href="post.html?id=${encodeURIComponent(p.id)}">
        ${p.cover_url?`<img class="post-thumb" src="${esc(p.cover_url)}" alt="">`:`<div class="post-thumb"></div>`}
        <div class="post-body"><div class="meta">${esc(p.category)} · ${esc(p.post_date)}</div><h3>${esc(p.title)}</h3></div>
      </a>`).join("");
  }catch(e){el.innerHTML='<div class="empty">글 목록을 불러오지 못했습니다. API 설정을 확인하세요.</div>'}
}
document.addEventListener("DOMContentLoaded",()=>{renderTimeline();loadLatest()});
