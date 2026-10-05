// Provider connection only. No secret key or user password belongs in this file.
export function createCloudClient(config,request=fetch){
 const url=config.url?.replace(/\/$/,'');const key=config.publishableKey;
 if(!url||!key)return null;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key.startsWith('sb_publishable_'))throw Error('請使用 Supabase 專案網址與 publishable key。');
 let session=null,version=0;
 async function call(path,body,method='POST'){
  const headers={apikey:key,'Content-Type':'application/json'};
  if(session?.access_token)headers.Authorization='Bearer '+session.access_token;
  const response=await request(url+path,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw Error(data?.message??data?.msg??data?.error_description??'連線失敗，請重試。');return data;
 }
 return {
  get user(){return session?.user??null;},get version(){return version;},
  async signIn(email,password){session=await call('/auth/v1/token?grant_type=password',{email,password});version=0;return session.user;},
  async signUp(email,password){return call('/auth/v1/signup',{email,password});},
  async resetPassword(email){return call('/auth/v1/recover',{email});},
  async changePassword(password){if(!session)throw Error('請先登入。');await call('/auth/v1/user',{password},'PUT');},
  async recoverFromHash(hash){const params=new URLSearchParams(hash.replace(/^#/,''));if(params.get('type')!=='recovery'||!params.get('access_token'))return false;session={access_token:params.get('access_token'),refresh_token:params.get('refresh_token')};try{session.user=await call('/auth/v1/user',undefined,'GET');return true;}catch(error){session=null;throw error;}},
  async refresh(){if(!session?.refresh_token)throw Error('登入已失效，請重新登入。');session=await call('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token});},
  async signOut(){try{if(session)await call('/auth/v1/logout',{});}finally{session=null;version=0;}},
  async load(){if(!session)throw Error('請先登入。');const rows=await call('/rest/v1/workspaces?select=payload,version',undefined,'GET');const row=rows?.[0];version=row?.version??0;return row?.payload??null;},
  async save(payload){if(!session)throw Error('請先登入。');const next=await call('/rest/v1/rpc/save_workspace',{document:payload,expected_version:version});if(!Number.isInteger(next))throw Error('同步回應格式不正確。');version=next;return version;}
 };
}
