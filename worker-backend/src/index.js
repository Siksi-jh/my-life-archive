
const enc=new TextEncoder();

function cors(req,env){
  const origin=req.headers.get("Origin")||"";
  const allow=origin===env.FRONTEND_ORIGIN?origin:env.FRONTEND_ORIGIN;
  return {
    "Access-Control-Allow-Origin":allow,
    "Access-Control-Allow-Headers":"Content-Type, Authorization",
    "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
    "Access-Control-Max-Age":"86400",
    "Vary":"Origin"
  }
}
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8",...headers}})}
function b64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function fromB64url(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function hmac(data,secret){const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);return new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(data)))}
async function makeToken(secret){
  const payload=b64url(enc.encode(JSON.stringify({exp:Date.now()+1000*60*60*12})));
  const sig=b64url(await hmac(payload,secret)); return payload+"."+sig
}
async function validToken(token,secret){
  try{const [p,s]=token.split(".");if(!p||!s)return false;const expected=await hmac(p,secret), got=fromB64url(s);if(expected.length!==got.length)return false;let diff=0;for(let i=0;i<expected.length;i++)diff|=expected[i]^got[i];if(diff!==0)return false;const obj=JSON.parse(new TextDecoder().decode(fromB64url(p)));return obj.exp>Date.now()}catch{return false}
}
async function requireAuth(req,env){
  const h=req.headers.get("Authorization")||""; if(!h.startsWith("Bearer "))return false;
  return validToken(h.slice(7),env.SESSION_SECRET)
}
function extFromType(t){return({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/heic":"heic","image/heif":"heif"}[t]||"bin")}

export default {
async fetch(request,env){
  const u=new URL(request.url), C=cors(request,env);
  if(request.method==="OPTIONS") return new Response(null,{headers:C});

  if(u.pathname==="/api/login" && request.method==="POST"){
    const b=await request.json().catch(()=>({}));
    if(!b.password || b.password!==env.ADMIN_PASSWORD) return json({error:"비밀번호가 올바르지 않습니다."},401,C);
    return json({token:await makeToken(env.SESSION_SECRET)},200,C);
  }

  if(u.pathname==="/api/posts" && request.method==="GET"){
    const limit=Math.min(Number(u.searchParams.get("limit")||30),200);
    const category=u.searchParams.get("category"), year=u.searchParams.get("year");
    let q=`SELECT p.*, (SELECT object_key FROM images i WHERE i.post_id=p.id ORDER BY sort_order,id LIMIT 1) cover_key FROM posts p`;
    const w=[], vals=[];
    if(category){w.push("category=?");vals.push(category)}
    if(year){w.push("substr(post_date,1,4)=?");vals.push(year)}
    if(w.length)q+=" WHERE "+w.join(" AND ");
    q+=" ORDER BY post_date DESC, id DESC LIMIT ?";
    vals.push(limit);
    const {results}=await env.DB.prepare(q).bind(...vals).all();
    const base=u.origin;
    const posts=results.map(p=>({...p,cover_url:p.cover_key?`${base}/media/${encodeURIComponent(p.cover_key)}`:null}));
    return json({posts},200,C);
  }

  const postMatch=u.pathname.match(/^\/api\/posts\/(\d+)$/);
  if(postMatch && request.method==="GET"){
    const id=Number(postMatch[1]);
    const p=await env.DB.prepare("SELECT * FROM posts WHERE id=?").bind(id).first();
    if(!p)return json({error:"not found"},404,C);
    const {results}=await env.DB.prepare("SELECT id,object_key,sort_order FROM images WHERE post_id=? ORDER BY sort_order,id").bind(id).all();
    p.images=results.map(x=>({id:x.id,url:`${u.origin}/media/${encodeURIComponent(x.object_key)}`}));
    return json(p,200,C);
  }

  if(u.pathname==="/api/posts" && request.method==="POST"){
    if(!(await requireAuth(request,env)))return json({error:"로그인이 필요합니다."},401,C);
    const form=await request.formData();
    const title=String(form.get("title")||"").trim(), body=String(form.get("body")||""), category=String(form.get("category")||"DIARY"), post_date=String(form.get("post_date")||"");
    if(!title||!/^\d{4}-\d{2}-\d{2}$/.test(post_date))return json({error:"제목과 날짜를 확인하세요."},400,C);
    const res=await env.DB.prepare("INSERT INTO posts(title,body,category,post_date) VALUES(?,?,?,?)").bind(title,body,category,post_date).run();
    const postId=res.meta.last_row_id;
    const photos=form.getAll("photos").filter(x=>x && typeof x==="object" && x.size>0).slice(0,20);
    let n=0;
    for(const f of photos){
      if(f.size>15*1024*1024)continue;
      const key=`posts/${postId}/${Date.now()}-${crypto.randomUUID()}.${extFromType(f.type)}`;
      await env.MEDIA.put(key,await f.arrayBuffer(),{httpMetadata:{contentType:f.type||"application/octet-stream"}});
      await env.DB.prepare("INSERT INTO images(post_id,object_key,sort_order) VALUES(?,?,?)").bind(postId,key,n++).run();
    }
    return json({ok:true,id:postId},201,C);
  }

  const mediaMatch=u.pathname.match(/^\/media\/(.+)$/);
  if(mediaMatch && request.method==="GET"){
    const key=decodeURIComponent(mediaMatch[1]), obj=await env.MEDIA.get(key);
    if(!obj)return new Response("Not found",{status:404,headers:C});
    const h=new Headers(C);obj.writeHttpMetadata(h);h.set("etag",obj.httpEtag);h.set("cache-control","public,max-age=31536000,immutable");
    return new Response(obj.body,{headers:h});
  }

  return json({error:"not found"},404,C);
}
}
