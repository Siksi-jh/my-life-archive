const enc=new TextEncoder();
let schemaReady=false;

function cors(req,env){
  const origin=req.headers.get("Origin")||"";
  const allow=origin===env.FRONTEND_ORIGIN?origin:env.FRONTEND_ORIGIN;
  return {"Access-Control-Allow-Origin":allow,"Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS","Access-Control-Max-Age":"86400","Vary":"Origin"}
}
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8",...headers}})}
function b64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function fromB64url(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function hmac(data,secret){const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);return new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(data)))}
async function makeToken(secret){const payload=b64url(enc.encode(JSON.stringify({exp:Date.now()+1000*60*60*12})));const sig=b64url(await hmac(payload,secret));return payload+"."+sig}
async function validToken(token,secret){try{const[p,s]=token.split(".");if(!p||!s)return false;const ex=await hmac(p,secret),got=fromB64url(s);if(ex.length!==got.length)return false;let diff=0;for(let i=0;i<ex.length;i++)diff|=ex[i]^got[i];if(diff!==0)return false;const o=JSON.parse(new TextDecoder().decode(fromB64url(p)));return o.exp>Date.now()}catch{return false}}
async function requireAuth(req,env){const h=req.headers.get("Authorization")||"";return h.startsWith("Bearer ")&&await validToken(h.slice(7),env.SESSION_SECRET)}
function extFromType(t){return({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/heic":"heic","image/heif":"heif"}[t]||"bin")}

async function ensureSchema(env){
  if(schemaReady)return;
  const {results}=await env.DB.prepare("PRAGMA table_info(posts)").all();
  if(!results.some(x=>x.name==="visibility"))await env.DB.prepare("ALTER TABLE posts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'").run();
  if(!results.some(x=>x.name==="deleted_at"))await env.DB.prepare("ALTER TABLE posts ADD COLUMN deleted_at TEXT").run();
  schemaReady=true;
}
async function getPostWithImages(id,env,origin,{includeDeleted=false}={}){
  const q=includeDeleted?"SELECT * FROM posts WHERE id=?":"SELECT * FROM posts WHERE id=? AND deleted_at IS NULL";
  const p=await env.DB.prepare(q).bind(id).first();if(!p)return null;
  const {results}=await env.DB.prepare("SELECT id,object_key,sort_order FROM images WHERE post_id=? ORDER BY sort_order,id").bind(id).all();
  p.images=results.map(x=>({id:x.id,url:`${origin}/media/${encodeURIComponent(x.object_key)}`}));
  return p;
}
async function saveUploads(form,postId,env,startSort=0){
  const photos=form.getAll("photos").filter(x=>x&&typeof x==="object"&&x.size>0).slice(0,20);let n=startSort;
  for(const f of photos){if(f.size>15*1024*1024)continue;const key=`posts/${postId}/${Date.now()}-${crypto.randomUUID()}.${extFromType(f.type)}`;await env.MEDIA.put(key,await f.arrayBuffer(),{httpMetadata:{contentType:f.type||"application/octet-stream"}});await env.DB.prepare("INSERT INTO images(post_id,object_key,sort_order) VALUES(?,?,?)").bind(postId,key,n++).run()}
}
async function deleteImageIds(ids,postId,env){for(const raw of ids){const id=Number(raw);if(!id)continue;const row=await env.DB.prepare("SELECT object_key FROM images WHERE id=? AND post_id=?").bind(id,postId).first();if(row){await env.MEDIA.delete(row.object_key);await env.DB.prepare("DELETE FROM images WHERE id=? AND post_id=?").bind(id,postId).run()}}}
async function deletePostAll(id,env){
  const {results}=await env.DB.prepare("SELECT object_key FROM images WHERE post_id=?").bind(id).all();
  for(const x of results)await env.MEDIA.delete(x.object_key);
  await env.DB.prepare("DELETE FROM images WHERE post_id=?").bind(id).run();
  await env.DB.prepare("DELETE FROM posts WHERE id=?").bind(id).run();
}
async function cleanupExpiredTrash(env){
  const {results}=await env.DB.prepare("SELECT id FROM posts WHERE deleted_at IS NOT NULL AND datetime(deleted_at) <= datetime('now','-7 days')").all();
  for(const row of results)await deletePostAll(row.id,env);
  return results.length;
}

async function handleFetch(request,env){
  const u=new URL(request.url),C=cors(request,env);
  if(request.method==="OPTIONS")return new Response(null,{headers:C});
  await ensureSchema(env);

  if(u.pathname==="/api/login"&&request.method==="POST"){
    const b=await request.json().catch(()=>({}));if(!b.password||b.password!==env.ADMIN_PASSWORD)return json({error:"비밀번호가 올바르지 않습니다."},401,C);return json({token:await makeToken(env.SESSION_SECRET)},200,C)
  }

  if(u.pathname==="/api/private/list"&&request.method==="POST"){
    const b=await request.json().catch(()=>({}));
    const expected=env.PRIVATE_VIEW_PASSWORD||env.ADMIN_PASSWORD;
    if(!b.password||b.password!==expected)return json({error:"비밀번호가 올바르지 않습니다."},401,C);
    const {results}=await env.DB.prepare(`SELECT p.*, (SELECT object_key FROM images i WHERE i.post_id=p.id ORDER BY sort_order,id LIMIT 1) cover_key FROM posts p WHERE visibility='private' AND deleted_at IS NULL ORDER BY post_date DESC,id DESC LIMIT 200`).all();
    return json({posts:results.map(p=>({...p,cover_url:p.cover_key?`${u.origin}/media/${encodeURIComponent(p.cover_key)}`:null}))},200,C)
  }

  if(u.pathname==="/api/posts"&&request.method==="GET"){
    const limit=Math.min(Number(u.searchParams.get("limit")||30),200),category=u.searchParams.get("category"),year=u.searchParams.get("year");
    const includePrivate=u.searchParams.get("include_private")==="1" && await requireAuth(request,env);
    let q=`SELECT p.*, (SELECT object_key FROM images i WHERE i.post_id=p.id ORDER BY sort_order,id LIMIT 1) cover_key FROM posts p`;
    const w=["deleted_at IS NULL"],vals=[];
    if(!includePrivate)w.push("visibility='public'");
    if(category){w.push("category=?");vals.push(category)}if(year){w.push("substr(post_date,1,4)=?");vals.push(year)}
    q+=" WHERE "+w.join(" AND ");q+=" ORDER BY post_date DESC,id DESC LIMIT ?";vals.push(limit);
    const {results}=await env.DB.prepare(q).bind(...vals).all();
    return json({posts:results.map(p=>({...p,cover_url:p.cover_key?`${u.origin}/media/${encodeURIComponent(p.cover_key)}`:null}))},200,C)
  }

  if(u.pathname==="/api/admin/trash"&&request.method==="GET"){
    if(!(await requireAuth(request,env)))return json({error:"로그인이 필요합니다."},401,C);
    await cleanupExpiredTrash(env);
    const {results}=await env.DB.prepare(`SELECT p.*, (SELECT object_key FROM images i WHERE i.post_id=p.id ORDER BY sort_order,id LIMIT 1) cover_key FROM posts p WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC,id DESC LIMIT 200`).all();
    return json({posts:results.map(p=>({...p,cover_url:p.cover_key?`${u.origin}/media/${encodeURIComponent(p.cover_key)}`:null}))},200,C)
  }

  const adminMatch=u.pathname.match(/^\/api\/admin\/posts\/(\d+)$/);
  if(adminMatch&&request.method==="GET"){
    if(!(await requireAuth(request,env)))return json({error:"로그인이 필요합니다."},401,C);
    const p=await getPostWithImages(Number(adminMatch[1]),env,u.origin);return p?json(p,200,C):json({error:"not found"},404,C)
  }

  const restoreMatch=u.pathname.match(/^\/api\/admin\/posts\/(\d+)\/restore$/);
  if(restoreMatch&&request.method==="POST"){
    if(!(await requireAuth(request,env)))return json({error:"로그인이 필요합니다."},401,C);
    const id=Number(restoreMatch[1]);
    const row=await env.DB.prepare("SELECT id FROM posts WHERE id=? AND deleted_at IS NOT NULL").bind(id).first();
    if(!row)return json({error:"휴지통에서 글을 찾지 못했습니다."},404,C);
    await env.DB.prepare("UPDATE posts SET deleted_at=NULL WHERE id=?").bind(id).run();
    return json({ok:true,id},200,C)
  }

  const permanentMatch=u.pathname.match(/^\/api\/admin\/posts\/(\d+)\/permanent$/);
  if(permanentMatch&&request.method==="DELETE"){
    if(!(await requireAuth(request,env)))return json({error:"로그인이 필요합니다."},401,C);
    const id=Number(permanentMatch[1]);
    const row=await env.DB.prepare("SELECT id FROM posts WHERE id=? AND deleted_at IS NOT NULL").bind(id).first();
    if(!row)return json({error:"휴지통에서 글을 찾지 못했습니다."},404,C);
    await deletePostAll(id,env);return json({ok:true},200,C)
  }

  const m=u.pathname.match(/^\/api\/posts\/(\d+)$/);
  if(m&&request.method==="GET"){
    const p=await getPostWithImages(Number(m[1]),env,u.origin);if(!p)return json({error:"not found"},404,C);
    if(p.visibility==="private")return json({private:true},403,C);
    return json(p,200,C)
  }

  const unlock=u.pathname.match(/^\/api\/posts\/(\d+)\/unlock$/);
  if(unlock&&request.method==="POST"){
    const p=await getPostWithImages(Number(unlock[1]),env,u.origin);if(!p)return json({error:"not found"},404,C);
    const b=await request.json().catch(()=>({}));const expected=env.PRIVATE_VIEW_PASSWORD||env.ADMIN_PASSWORD;
    if(!b.password||b.password!==expected)return json({error:"비밀번호가 올바르지 않습니다."},401,C);
    return json(p,200,C)
  }

  if(u.pathname==="/api/posts"&&request.method==="POST"){
    if(!(await requireAuth(request,env)))return json({error:"로그인이 필요합니다."},401,C);
    const f=await request.formData(),title=String(f.get("title")||"").trim(),body=String(f.get("body")||""),category=String(f.get("category")||"DIARY"),post_date=String(f.get("post_date")||""),visibility=String(f.get("visibility")||"public");
    if(!title||!/^\d{4}-\d{2}-\d{2}$/.test(post_date))return json({error:"제목과 날짜를 확인하세요."},400,C);
    const res=await env.DB.prepare("INSERT INTO posts(title,body,category,post_date,visibility,deleted_at) VALUES(?,?,?,?,?,NULL)").bind(title,body,category,post_date,visibility==="private"?"private":"public").run();
    const id=res.meta.last_row_id;await saveUploads(f,id,env,0);return json({ok:true,id},201,C)
  }

  if(m&&request.method==="PUT"){
    if(!(await requireAuth(request,env)))return json({error:"로그인이 필요합니다."},401,C);
    const id=Number(m[1]),f=await request.formData(),title=String(f.get("title")||"").trim(),body=String(f.get("body")||""),category=String(f.get("category")||"DIARY"),post_date=String(f.get("post_date")||""),visibility=String(f.get("visibility")||"public");
    const existing=await env.DB.prepare("SELECT id FROM posts WHERE id=? AND deleted_at IS NULL").bind(id).first();
    if(!existing)return json({error:"수정할 글을 찾지 못했습니다."},404,C);
    await env.DB.prepare("UPDATE posts SET title=?,body=?,category=?,post_date=?,visibility=? WHERE id=? AND deleted_at IS NULL").bind(title,body,category,post_date,visibility==="private"?"private":"public",id).run();
    await deleteImageIds(f.getAll("remove_image_ids"),id,env);const c=await env.DB.prepare("SELECT COALESCE(MAX(sort_order),-1) m FROM images WHERE post_id=?").bind(id).first();await saveUploads(f,id,env,Number(c?.m??-1)+1);return json({ok:true,id},200,C)
  }

  if(m&&request.method==="DELETE"){
    if(!(await requireAuth(request,env)))return json({error:"로그인이 필요합니다."},401,C);
    const id=Number(m[1]);
    const row=await env.DB.prepare("SELECT id FROM posts WHERE id=? AND deleted_at IS NULL").bind(id).first();
    if(!row)return json({error:"삭제할 글을 찾지 못했습니다."},404,C);
    await env.DB.prepare("UPDATE posts SET deleted_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
    return json({ok:true,trashed:true,expires_in_days:7},200,C)
  }

  const mm=u.pathname.match(/^\/media\/(.+)$/);
  if(mm&&request.method==="GET"){
    const obj=await env.MEDIA.get(decodeURIComponent(mm[1]));if(!obj)return new Response("Not found",{status:404,headers:C});const h=new Headers(C);obj.writeHttpMetadata(h);h.set("etag",obj.httpEtag);h.set("cache-control","public,max-age=31536000,immutable");return new Response(obj.body,{headers:h})
  }
  return json({error:"not found"},404,C)
}

export default {
  async fetch(request,env){return handleFetch(request,env)},
  async scheduled(controller,env,ctx){
    ctx.waitUntil((async()=>{await ensureSchema(env);await cleanupExpiredTrash(env)})());
  }
}
