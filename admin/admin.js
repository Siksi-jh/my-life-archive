
let token=sessionStorage.getItem("theYearsToken")||"";
let files=[], removedImageIds=[];
const $=s=>document.querySelector(s);
function base(){return (SITE_CONFIG.apiBase||"").replace(/\/$/,"")}
function status(el,msg,ok=false){el.textContent=msg;el.className="status show "+(ok?"ok":"err")}
function showArea(on){$("#login").classList.toggle("hidden",on);$("#adminArea").classList.toggle("hidden",!on)}
function auth(){return {authorization:"Bearer "+token}}
function fmt(s){return (s||"").slice(0,10)}

function koreaDateString(){
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Seoul",
    year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date());
  const v=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${v.year}-${v.month}-${v.day}`;
}

function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

function renderPreview(){
  const p=$("#preview");p.innerHTML="";
  files.forEach((f,i)=>{
    const w=document.createElement("div");w.className="pwrap";
    const img=document.createElement("img");img.src=URL.createObjectURL(f);
    const b=document.createElement("button");b.textContent="×";b.onclick=()=>{files.splice(i,1);renderPreview()};
    w.append(img,b);p.append(w)
  })
}
function renderExisting(images=[]){
  const wrap=$("#existingWrap"), p=$("#existingPreview");
  p.innerHTML="";
  if(!images.length){wrap.classList.add("hidden");return}
  wrap.classList.remove("hidden");
  images.filter(x=>!removedImageIds.includes(x.id)).forEach(x=>{
    const w=document.createElement("div");w.className="pwrap";
    const img=document.createElement("img");img.src=x.url;
    const b=document.createElement("button");b.textContent="×";b.onclick=()=>{removedImageIds.push(x.id);renderExisting(images)};
    w.append(img,b);p.append(w)
  });
}
function resetEditor(){
  $("#editingId").value="";$("#title").value="";$("#body").value="";
  $("#postDate").value=koreaDateString();$("#category").value="DIARY";if($("#visibility")) $("#visibility").value="public";
  files=[];removedImageIds=[];renderPreview();renderExisting([]);
  $("#modeKicker").textContent="New post";$("#editorHeading").textContent="새 글 작성";
  $("#publishBtn").textContent="게시하기";$("#deleteBtn").classList.add("hidden");$("#newBtn").classList.add("hidden");
  $("#status").className="status";$("#status").textContent="";
}
async function loadPosts(){
  const el=$("#postList"); el.innerHTML='<div class="empty">불러오는 중...</div>';
  try{
    const r=await fetch(base()+"/api/posts?limit=200&include_private=1",{headers:auth()});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||"목록 불러오기 실패");
    el.innerHTML=(d.posts||[]).map(p=>`
      <div class="admin-post-row">
        <div>
          <div class="meta">${esc(p.category)} · ${esc(p.post_date)} · <span class="visibility-badge ${p.visibility==="private"?"private":""}">${p.visibility==="private"?"비공개":"공개"}</span></div>
          <strong>${esc(p.title)}</strong>
        </div>
        <div class="admin-row-actions">
          <a class="btn btn-soft mini" href="../post.html?id=${p.id}" target="_blank">보기</a>
          <button class="btn btn-soft mini" data-edit="${p.id}">수정</button>
          <button class="btn btn-danger mini" data-del="${p.id}">삭제</button>
        </div>
      </div>`).join("")||'<div class="empty">아직 작성한 글이 없습니다.</div>';
    el.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editPost(b.dataset.edit));
    el.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>deletePost(b.dataset.del));
  }catch(e){el.innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}
async function editPost(id){
  try{
    const r=await fetch(base()+"/api/admin/posts/"+id,{headers:auth()});
    const p=await r.json();if(!r.ok)throw new Error(p.error||"글 불러오기 실패");
    $("#editingId").value=p.id;$("#postDate").value=fmt(p.post_date);$("#category").value=p.category;if($("#visibility")) $("#visibility").value=p.visibility||"public";
    $("#title").value=p.title;$("#body").value=p.body||"";
    files=[];removedImageIds=[];renderPreview();renderExisting(p.images||[]);
    $("#modeKicker").textContent="Edit post";$("#editorHeading").textContent="글 수정";$("#publishBtn").textContent="수정 저장";
    $("#deleteBtn").classList.remove("hidden");$("#newBtn").classList.remove("hidden");
    window.scrollTo({top:0,behavior:"smooth"});
  }catch(e){status($("#status"),e.message)}
}
async function deletePost(id){
  if(!confirm("이 글과 첨부 사진을 모두 삭제할까요?"))return;
  try{
    const r=await fetch(base()+"/api/posts/"+id,{method:"DELETE",headers:auth()});
    const d=await r.json();if(!r.ok)throw new Error(d.error||"삭제 실패");
    if(String($("#editingId").value)===String(id))resetEditor();
    await loadPosts();
  }catch(e){status($("#status"),e.message)}
}
async function savePost(){
  const st=$("#status"), id=$("#editingId").value;
  if(!$("#title").value.trim())return status(st,"제목을 입력하세요.");
  try{
    const fd=new FormData();
    fd.append("title",$("#title").value.trim());
    fd.append("body",$("#body").value);
    fd.append("category",$("#category").value);
    fd.append("post_date",$("#postDate").value);
    fd.append("visibility", $("#visibility") ? $("#visibility").value : "public");
    removedImageIds.forEach(x=>fd.append("remove_image_ids",String(x)));
    files.forEach(f=>fd.append("photos",f));
    const r=await fetch(base()+(id?"/api/posts/"+id:"/api/posts"),{method:id?"PUT":"POST",headers:auth(),body:fd});
    const raw=await r.text();
    let d={}; try{d=raw?JSON.parse(raw):{}}catch{throw new Error("서버 응답을 읽지 못했습니다. Worker 배포 상태를 확인하세요.")}
    if(!r.ok)throw new Error(d.error||(id?"수정 실패":"게시 실패"));
    resetEditor(); await loadPosts();
    status(st,id?"수정되었습니다.":"게시되었습니다.",true);
  }catch(e){status(st,e.message)}
}
document.addEventListener("DOMContentLoaded",()=>{
  $("#postDate").value=koreaDateString();
  if(token){showArea(true);loadPosts()}
  $("#loginBtn").onclick=async()=>{
    if(!base())return status($("#loginStatus"),"js/config.js의 Worker API 주소를 확인하세요.");
    try{
      const r=await fetch(base()+"/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password:$("#password").value})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"로그인 실패");
      token=d.token;sessionStorage.setItem("theYearsToken",token);showArea(true);loadPosts()
    }catch(e){status($("#loginStatus"),e.message)}
  };
  $("#logoutBtn").onclick=()=>{token="";sessionStorage.removeItem("theYearsToken");showArea(false)};
  $("#newBtn").onclick=resetEditor;$("#refreshBtn").onclick=loadPosts;
  $("#deleteBtn").onclick=()=>deletePost($("#editingId").value);$("#publishBtn").onclick=savePost;
  $("#dropzone").onclick=()=>$("#photos").click();$("#photos").onchange=e=>{files=[...e.target.files];renderPreview()};
  $("#dropzone").ondragover=e=>e.preventDefault();
  $("#dropzone").ondrop=e=>{e.preventDefault();files=[...e.dataTransfer.files].filter(f=>f.type.startsWith("image/"));renderPreview()};
});
