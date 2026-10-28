function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function api(path){const b=(window.SITE_CONFIG.apiBase||"").replace(/\/$/,""); return b ? b+path : ""}

const MONTH_NAMES=["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];

async function renderTimeline(){
  const wrap=document.querySelector("#timeline");
  const switcher=document.querySelector("#year-switcher");
  if(!wrap) return;

  if(!SITE_CONFIG.apiBase){
    wrap.innerHTML='<div class="monthly-empty">API 연결 후 월별 기록이 여기에 표시됩니다.</div>';
    return;
  }

  try{
    const r=await fetch(api("/api/posts?limit=200"));
    const data=await r.json();
    const posts=Array.isArray(data.posts)?data.posts:[];

    if(!posts.length){
      wrap.innerHTML='<div class="monthly-empty">아직 월별로 정리할 기록이 없습니다.</div>';
      if(switcher) switcher.innerHTML="";
      return;
    }

    const years=[...new Set(posts.map(p=>String(p.post_date||"").slice(0,4)).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));
    const currentYear=String(new Date().getFullYear());
    let activeYear=years.includes(currentYear)?currentYear:years[0];

    function drawYear(year){
      activeYear=year;
      if(switcher){
        switcher.querySelectorAll("button").forEach(btn=>btn.classList.toggle("active",btn.dataset.year===year));
      }

      const yearPosts=posts.filter(p=>String(p.post_date||"").startsWith(year+"-"));
      const groups={};
      yearPosts.forEach(p=>{
        const month=String(p.post_date||"").slice(5,7);
        if(!month) return;
        (groups[month]??=[]).push(p);
      });

      const months=Object.keys(groups).sort((a,b)=>Number(b)-Number(a));
      if(!months.length){
        wrap.innerHTML='<div class="monthly-empty">이 해에는 아직 기록이 없습니다.</div>';
        return;
      }

      wrap.innerHTML=months.map(month=>{
        const entries=groups[month].sort((a,b)=>String(b.post_date).localeCompare(String(a.post_date)));
        const monthName=MONTH_NAMES[Math.max(0,Math.min(11,Number(month)-1))];
        return `
          <section class="month-group">
            <div class="month-label">
              <span class="month-name">${monthName}</span>
              <span class="month-count">${year} · ${entries.length} ${entries.length===1?'ENTRY':'ENTRIES'}</span>
            </div>
            <div class="month-posts">
              ${entries.map(p=>`
                <a class="month-entry" href="post.html?id=${encodeURIComponent(p.id)}">
                  ${p.cover_url?`<img class="month-entry-thumb" src="${esc(p.cover_url)}" alt="">`:`<div class="month-entry-thumb"></div>`}
                  <div class="month-entry-copy">
                    <div class="month-entry-meta">${esc(p.category)} · ${esc(p.post_date)}</div>
                    <h3 class="month-entry-title">${esc(p.title)}</h3>
                  </div>
                </a>`).join("")}
            </div>
          </section>`;
      }).join("");
    }

    if(switcher){
      switcher.innerHTML=years.map(y=>`<button type="button" data-year="${y}" class="${y===activeYear?'active':''}">${y}</button>`).join("");
      switcher.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>drawYear(btn.dataset.year)));
    }
    drawYear(activeYear);
  }catch(e){
    wrap.innerHTML='<div class="monthly-empty">월별 기록을 불러오지 못했습니다.</div>';
  }
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
