
let token=sessionStorage.getItem("theYearsToken")||"", files=[];
const $=s=>document.querySelector(s);
function base(){return (SITE_CONFIG.apiBase||"").replace(/\/$/,"")}
function status(el,msg,ok=false){el.textContent=msg;el.className="status show "+(ok?"ok":"err")}
function showEditor(on){$("#login").classList.toggle("hidden",on);$("#editor").classList.toggle("hidden",!on)}
function renderPreview(){const p=$("#preview");p.innerHTML="";files.forEach((f,i)=>{const w=document.createElement("div");w.className="pwrap";const img=document.createElement("img");img.src=URL.createObjectURL(f);const b=document.createElement("button");b.textContent="×";b.onclick=()=>{files.splice(i,1);renderPreview()};w.append(img,b);p.append(w)})}
document.addEventListener("DOMContentLoaded",()=>{
 $("#postDate").value=new Date().toISOString().slice(0,10); if(token)showEditor(true);
 $("#loginBtn").onclick=async()=>{if(!base())return status($("#loginStatus"),"먼저 js/config.js에 Worker API 주소를 넣어주세요.");
  try{const r=await fetch(base()+"/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password:$("#password").value})});const d=await r.json();if(!r.ok)throw new Error(d.error||"로그인 실패");token=d.token;sessionStorage.setItem("theYearsToken",token);showEditor(true)}catch(e){status($("#loginStatus"),e.message)}
 };
 $("#logoutBtn").onclick=()=>{token="";sessionStorage.removeItem("theYearsToken");showEditor(false)};
 $("#dropzone").onclick=()=>$("#photos").click();
 $("#photos").onchange=e=>{files=[...e.target.files];renderPreview()};
 $("#dropzone").ondragover=e=>e.preventDefault();
 $("#dropzone").ondrop=e=>{e.preventDefault();files=[...e.dataTransfer.files].filter(f=>f.type.startsWith("image/"));renderPreview()};
 $("#publishBtn").onclick=async()=>{
  const st=$("#status"); if(!$("#title").value.trim())return status(st,"제목을 입력하세요.");
  try{
    const fd=new FormData();fd.append("title",$("#title").value.trim());fd.append("body",$("#body").value);fd.append("category",$("#category").value);fd.append("post_date",$("#postDate").value);
    files.forEach(f=>fd.append("photos",f));
    const r=await fetch(base()+"/api/posts",{method:"POST",headers:{authorization:"Bearer "+token},body:fd});const d=await r.json();if(!r.ok)throw new Error(d.error||"게시 실패");
    status(st,"게시되었습니다.",true);$("#title").value="";$("#body").value="";files=[];renderPreview();
  }catch(e){status(st,e.message)}
 };
});
