const SESSION_PREFIX='college-os-session-';
const clean=value=>String(value??'').replace(/\/$/,'');
const validSession=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.access_token==='string'&&!!value.access_token&&typeof value.refresh_token==='string'&&!!value.refresh_token&&value.user&&typeof value.user.id==='string'&&!!value.user.id;
async function readBounded(stream,maxBytes,label='知識包'){if(!stream)throw Error('雲端檔案沒有內容。');const reader=stream.getReader(),chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw Error(label+'超過大小上限。');}chunks.push(value);}}finally{reader.releaseLock();}const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result;}

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
  if(binary){const size=Number(response.headers?.get?.('content-length'));if(Number.isFinite(size)&&size>20e6)throw Error('雲端知識包超過 20 MB。');return readBounded(response.body,20e6,'雲端知識包');}
  return response.json();
 }
 const installSession=data=>{if(!data||typeof data.access_token!=='string'||!data.access_token||typeof data.refresh_token!=='string'||!data.refresh_token||!data.user||typeof data.user.id!=='string'||!data.user.id)throw Error('登入回應缺少有效的帳號或工作階段。');const expires=Number(data.expires_at??(data.expires_in?Date.now()/1000+Number(data.expires_in):0));if(!Number.isFinite(expires)||expires<0)throw Error('登入工作階段期限不正確。');session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:expires||null,token_type:typeof data.token_type==='string'?data.token_type:'bearer',user:data.user};persist();return data.user;};
 async function ensureSession(){
  if(session?.access_token&&(session.expires_at==null||session.expires_at>Date.now()/1000+45))return session;
  if(!session){try{session=JSON.parse(storage?.getItem(sessionKey)??'null');}catch{session=null;}if(!validSession(session)){session=null;persist();}}
  if(!session?.refresh_token)throw Error('請先登入。');
  try{installSession(await call('/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})}));return session;}
  catch(error){session=null;persist();throw error;}
 }
 async function auth(path,body){return call('/auth/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
 async function rpc(name,body){return call('/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
 return {
  get user(){return session?.user??null;},get version(){return version;},
  async restoreSession(){if(!session){try{session=JSON.parse(storage?.getItem(sessionKey)??'null');}catch{session=null;}}if(!validSession(session)){session=null;persist();return null;}await ensureSession();return session.user;},
  async signIn(email,password){const result=await auth('token?grant_type=password',{email,password});version=0;return installSession(result);},
  async signUp(email,password){return auth('signup',{email,password});},
  async resetPassword(email){return call('/auth/v1/recover?redirect_to='+encodeURIComponent(location.origin+location.pathname),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});},
  async recoverFromHash(hash){const p=new URLSearchParams(String(hash??'').replace(/^#/,'').replace(/^\?/,'') );const access=p.get('access_token'),refresh=p.get('refresh_token');if(!access||!refresh)return false;const rawExpiry=p.get('expires_at'),rawLifetime=p.get('expires_in');let expires;if(rawExpiry!==null){if(!/^\d+$/.test(rawExpiry))throw Error('密碼重設連結期限格式不正確，請重新申請。');expires=Number(rawExpiry);}else if(rawLifetime!==null){if(!/^\d+$/.test(rawLifetime)||Number(rawLifetime)<=0)throw Error('密碼重設連結期限格式不正確，請重新申請。');expires=Math.floor(Date.now()/1000)+Number(rawLifetime);}else throw Error('密碼重設連結缺少期限，請重新申請。');if(!Number.isSafeInteger(expires)||expires<=Date.now()/1000)throw Error('密碼重設連結已過期，請重新申請。');const response=await request(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+access}});if(!response.ok)throw Error('無法驗證密碼重設連結，請重新申請。');let user;try{user=await response.json();}catch{throw Error('登入服務回應格式不正確。');}installSession({access_token:access,refresh_token:refresh,expires_at:expires,user});return true;},
  async changePassword(password){await ensureSession();return call('/auth/v1/user',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});},
  async signOut(){try{if(session?.access_token)await call('/auth/v1/logout',{method:'POST'});}finally{session=null;version=0;persist();}},
  async refresh(){await ensureSession();const rows=await call('/rest/v1/workspaces?select=version&limit=1');const next=rows?.[0]?.version??0;if(!Number.isSafeInteger(next)||next<0)throw Error('雲端版本號格式不正確。');version=next;return version;},
  async load(){await ensureSession();const rows=await call('/rest/v1/workspaces?select=payload,version&limit=1');const row=rows?.[0];const next=row?.version??0;if(!Number.isSafeInteger(next)||next<0)throw Error('雲端版本號格式不正確。');if(row?.payload!==undefined&&(!row.payload||typeof row.payload!=='object'||Array.isArray(row.payload)))throw Error('雲端備份格式不正確。');version=next;return row?.payload??null;},
  async save(document){await ensureSession();if(!document||typeof document!=='object'||Array.isArray(document))throw Error('雲端備份必須是物件。');const result=Number(await rpc('save_workspace',{document,expected_version:version}));if(!Number.isSafeInteger(result)||result<1)throw Error('雲端儲存未回傳有效版本號。');version=result;return version;},
  async loadKnowledgePackage(){
   await ensureSession();const uid=encodeURIComponent(session.user.id);
   const rows=await call('/rest/v1/knowledge_packages?select=version,object_path,sha256&user_id=eq.'+uid+'&limit=1');
   const pointer=rows?.[0]??null;if(!pointer)return null;const pathParts=typeof pointer.object_path==='string'?pointer.object_path.split('/'):[];if(!Number.isSafeInteger(pointer.version)||pointer.version<1||pathParts.length!==2||pathParts[0]!==session.user.id||! /^[\da-f-]{36}\.(?:json|json\.gz)$/i.test(pathParts[1])||pathParts.some(part=>!part||part==='.'||part==='..'||part.includes('\\'))||!/^([a-f\d]{64})$/i.test(pointer.sha256??''))throw Error('雲端知識包索引格式不正確；本機資料未變更。');
   const raw=await call('/storage/v1/object/authenticated/college-knowledge/'+pointer.object_path.split('/').map(encodeURIComponent).join('/'),{},true);
   const bytes=new Uint8Array(raw),digest=await crypto.subtle.digest('SHA-256',bytes);
   const actual=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
   if(actual!==pointer.sha256)throw Error('雲端知識包校驗失敗；本機資料未變更。');
   let clear=bytes;if(bytes[0]===0x1f&&bytes[1]===0x8b){if(!globalThis.DecompressionStream)throw Error('此瀏覽器不支援 gzip，請更新 Safari。');clear=await readBounded(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),40e6);}
   if(clear.byteLength>40e6)throw Error('解壓後知識包超過 40 MB。');
   return {version:pointer.version,units:JSON.parse(new TextDecoder().decode(clear))};
  },
  async saveKnowledgePackage(units,expectedVersion=0){
   await ensureSession();const raw=new TextEncoder().encode(JSON.stringify(units));if(raw.byteLength>40e6)throw Error('知識包解壓後超過 40 MB，無法同步。');let bytes=raw,type='application/json';
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
