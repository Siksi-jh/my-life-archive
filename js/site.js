
const LIFE_START_YEAR=2026, LIFE_START_AGE=37, LIFE_END_YEAR=2089;
function renderYears(targetId){
 const el=document.getElementById(targetId); if(!el) return;
 const now=new Date().getFullYear();
 for(let y=LIFE_START_YEAR;y<=LIFE_END_YEAR;y++){
  const age=LIFE_START_AGE+(y-LIFE_START_YEAR);
  const a=document.createElement('a');
  a.href=(location.pathname.includes('/diary/')?'':'diary/')+`${y}/index.html`;
  a.className='year-card'+(y>now?' future':'');
  a.innerHTML=`<strong>${y} · ${age}세</strong><span>${y>now?'기록 예정':'기록 보기'}</span>`;
  el.appendChild(a);
 }
}
document.addEventListener('DOMContentLoaded',()=>renderYears('year-list'));
