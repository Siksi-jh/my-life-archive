
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function api(path){const b=(window.SITE_CONFIG.apiBase||"").replace(/\/$/,""); return b ? b+path : ""}

function ageOnDate(date, birthDateString){
  const [by,bm,bd]=birthDateString.split("-").map(Number);
  const y=date.getFullYear(), m=date.getMonth()+1, d=date.getDate();
  let age=y-by;
  if(m<bm || (m===bm && d<bd)) age--;
  return age;
}

function ageRangeForYear(year, birthDateString){
  const birthYear=Number(birthDateString.slice(0,4));
  const beforeBirthday=year-birthYear-1;
  const afterBirthday=year-birthYear;
  return {beforeBirthday, afterBirthday};
}

function renderTimeline(){
  const wrap=document.querySelector("#timeline"); if(!wrap) return;
  const cfg=SITE_CONFIG;
  const now=new Date();
  const currentYear=Math.max(cfg.startYear,Math.min(now.getFullYear(),cfg.endYear));
  const currentAge=ageOnDate(now,cfg.birthDate);

  const groups={};
  for(let y=cfg.startYear;y<=cfg.endYear;y++){
    const ages=ageRangeForYear(y,cfg.birthDate);
    const decade=Math.floor(ages.afterBirthday/10)*10;
    (groups[decade]??=[]).push({y,...ages});
  }

  const decadeKeys=Object.keys(groups).map(Number).sort((a,b)=>a-b);
  const activeDecade=Math.floor(ageRangeForYear(currentYear,cfg.birthDate).afterBirthday/10)*10;

  wrap.innerHTML=`
    <div class="current-year">
      <div>
        <strong>${currentYear}</strong> <span class="age">· 현재 만 ${currentAge}세</span>
        <div class="desc">12월 10일 생일 기준으로 자동 계산됩니다.</div>
      </div>
      <a class="cta" href="diary.html?year=${currentYear}">기록 보기</a>
    </div>

    <div class="decade-tabs">
      ${decadeKeys.map(d=>`<button class="${d===activeDecade?'active':''}" data-d="${d}">만 ${d}대</button>`).join("")}
    </div>

    ${decadeKeys.map(d=>`
      <div class="decade-panel ${d===activeDecade?'active':''}" data-panel="${d}">
        <div class="years">
          ${groups[d].map(o=>`
            <a class="year ${o.y===currentYear?'current':''} ${o.y>now.getFullYear()?'future':''}" href="diary.html?year=${o.y}">
              <strong>${o.y}</strong>
              <span>만 ${o.beforeBirthday}–${o.afterBirthday}세</span>
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
