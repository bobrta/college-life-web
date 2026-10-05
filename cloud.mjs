const SESSION_PREFIX='college-os-session-';
const clean=value=>String(value??'').replace(/\/$/,'');

export function createCloudClient(config,request=fetch,storage=globalThis.localStorage){
 if(config?.enabled===false||!config?.url||!config.publishableKey)return null;
 if(/secret|service_role/i.test(config.publishableKey))throw Error('前端只能使用 Supabase publishable/anon key。');
 const url=clean(config.url),key=config.publishableKey,sessionKey=SESSION_PREFIX+btoa(url).replace(/[^a-z\d]/gi,'').slice(0,24);
 let session=null,version=0;
 const persist=()=>{try{if(session)storage?.setItem(sessionKey,JSON.stringify(session));else storage?.removeItem(sessionKey);}catch{}};
 const headers=extra=>({'apikey':key,Authorization:'Bearer '+(session?.access_token??key),...(extra??{})});
 async function call(path,options={},binary=false){
  const response=await request(url+path,{method:'GET',...options,headers:headers(options.headers)});
  if(!response.ok){let body={};try{body=await response.json();}catch{}throw Error(body.message??body.msg??body.error_description??'服務錯誤 ('+response.status+')');}
  if(response.status===204)return null;
  if(binary)return response.arrayBuffer();
  return response.json();
 }
 const installSession=data=>{session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:data.expires_at??(data.expires_in?Date.now()/1000+data.expires_in:null),token_type:data.token_type??'bearer',user:data.user};persist();return data.user;};
 async function ensureSession(){
  if(session?.access_token&&(session.expires_at==null||session.expires_at>Date.now()/1000+45))return session;
  if(!session){try{session=JSON.parse(storage?.getItem(sessionKey)??'null');}catch{session=null;}}
  if(!session?.refresh_token)throw Error('請先登入。');
  try{installSession(await call('/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})}));return session;}
  catch(error){session=null;persist();throw error;}
 }
 async function auth(path,body){return call('/auth/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
 async function rpc(name,body){return call('/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
 return {
  get user(){return session?.user??null;},get version(){return version;},
  async restoreSession(){if(!session){try{session=JSON.parse(storage?.getItem(sessionKey)??'null');}catch{session=null;}}if(!session?.refresh_token)return null;await ensureSession();return session.user;},
  async signIn(email,password){const result=await auth('token?grant_type=password',{email,password});version=0;return installSession(result);},
  async signUp(email,password){return auth('signup',{email,password});},
  async resetPassword(email){return call('/auth/v1/recover?redirect_to='+encodeURIComponent(location.origin+location.pathname),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});},
  async recoverFromHash(hash){const p=new URLSearchParams(hash.replace(/^#/,'').replace(/^\?/,'') );const access=p.get('access_token'),refresh=p.get('refresh_token');if(!access||!refresh)return false;let user=null;try{const response=await request(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+access}});if(response.ok)user=await response.json();}catch{}installSession({access_token:access,refresh_token:refresh,expires_at:Number(p.get('expires_at'))||(p.get('expires_in')?Date.now()/1000+Number(p.get('expires_in')):null),user});return true;},
  async changePassword(password){await ensureSession();return call('/auth/v1/user',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});},
  async signOut(){try{if(session?.access_token)await call('/auth/v1/logout',{method:'POST'});}finally{session=null;version=0;persist();}},
  async refresh(){await ensureSession();const rows=await call('/rest/v1/workspaces?select=version&limit=1');version=rows?.[0]?.version??0;return version;},
  async load(){await ensureSession();const rows=await call('/rest/v1/workspaces?select=payload,version&limit=1');version=rows?.[0]?.version??0;return rows?.[0]?.payload??null;},
  async save(document){await ensureSession();const result=await rpc('save_workspace',{document,expected_version:version});version=Number(result);return version;},
  async loadKnowledgePackage(){
   await ensureSession();const uid=encodeURIComponent(session.user.id);
   const rows=await call('/rest/v1/knowledge_packages?select=version,object_path,sha256&user_id=eq.'+uid+'&limit=1');
   const pointer=rows?.[0]??null;if(!pointer)return null;
   const raw=await call('/storage/v1/object/authenticated/college-knowledge/'+pointer.object_path.split('/').map(encodeURIComponent).join('/'),{},true);
   const bytes=new Uint8Array(raw),digest=await crypto.subtle.digest('SHA-256',bytes);
   const actual=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
   if(actual!==pointer.sha256)throw Error('雲端知識包校驗失敗；本機資料未變更。');
   let clear=bytes;if(bytes[0]===0x1f&&bytes[1]===0x8b){if(!globalThis.DecompressionStream)throw Error('此瀏覽器不支援 gzip，請更新 Safari。');clear=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}
   if(clear.byteLength>40e6)throw Error('解壓後知識包超過 40 MB。');
   return {version:pointer.version,units:JSON.parse(new TextDecoder().decode(clear))};
  },
  async saveKnowledgePackage(units,expectedVersion=0){
   await ensureSession();const raw=new TextEncoder().encode(JSON.stringify(units));let bytes=raw,type='application/json';
   if(globalThis.CompressionStream){bytes=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());type='application/gzip';}
   if(bytes.byteLength>20e6)throw Error('知識包超過 20 MB，無法同步。');
   const digest=await crypto.subtle.digest('SHA-256',bytes),sha256=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
   const path=session.user.id+'/'+crypto.randomUUID()+'.'+(type==='application/gzip'?'json.gz':'json');
   await call('/storage/v1/object/college-knowledge/'+path.split('/').map(encodeURIComponent).join('/'),{method:'POST',headers:{'Content-Type':type,'x-upsert':'false'},body:bytes});
   try{return Number(await rpc('save_knowledge_pointer',{expected_version:expectedVersion,object_path:path,sha256}));}
   catch(error){try{await call('/storage/v1/object/college-knowledge',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[path]})});}catch{}if(/conflict/i.test(error.message))throw Error('KNOWLEDGE_SYNC_CONFLICT: 另一台裝置已有較新的知識包。');throw error;}
  }
 };
}
