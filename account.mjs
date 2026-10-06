import {createCloudClient} from './cloud.mjs?v=3.5';
import {createAutosync} from './autosync.mjs?v=3.5';
import {validateBackup,migrate,validateKnowledge} from './life.mjs?v=3.5';

export async function mountAccount(config,state,callbacks){
 const client=config.enabled?createCloudClient(config):null;
 if(!client)return;
 const container=document.querySelector('#settings .panel:last-child');
 container.innerHTML='<h2>Email 登入與跨裝置同步</h2><p>登入後，個人紀錄會透過 HTTPS 同步。知識包另存為私人加密傳輸檔，只有登入帳號能存取。</p><form id=\"account-form\" class=\"form-grid\"><label>Email<input id=\"account-email\" type=\"email\" autocomplete=\"username\" required></label><label>密碼<input id=\"account-password\" type=\"password\" autocomplete=\"current-password\" minlength=\"8\" required></label><button class=\"primary\">登入</button><button id=\"account-signup\" type=\"button\" class=\"secondary\">建立帳號</button><button id=\"account-reset\" type=\"button\" class=\"secondary\">寄送重設密碼信</button></form><div class=\"actions\"><button id=\"account-download\" class=\"secondary\" disabled>下載雲端紀錄</button><button id=\"account-upload\" class=\"primary\" disabled>立即同步紀錄</button><button id=\"knowledge-download\" class=\"secondary\" disabled>下載雲端知識包</button><button id=\"knowledge-upload\" class=\"primary\" disabled>同步此裝置知識包</button><button id=\"account-logout\" class=\"secondary\" disabled>登出</button></div><p id=\"account-status\" role=\"status\">請先登入。</p><p id=\"knowledge-account-status\" role=\"status\">知識包尚未同步。</p><form id=\"account-recovery\" class=\"form-grid\" hidden><label>新密碼<input id=\"recovery-password\" type=\"password\" autocomplete=\"new-password\" minlength=\"8\" required></label><button class=\"primary\">更新密碼</button></form>';
 const $=id=>document.getElementById(id),status=t=>$('account-status').textContent=t,kstatus=t=>$('knowledge-account-status').textContent=t;
 const empty=()=>migrate({tasks:{},wrong:[],mastery:{},events:[]});
 let busy=false,stale=false,logged=false,ignoreChange=false,knowledgeVersion=0,knowledgeStale=false;
 const autosync=createAutosync({client,getState:()=>state,saveLocal:()=>{ignoreChange=true;try{callbacks.save();}finally{ignoreChange=false;}},status,onConflict:()=>{stale=true;$('account-upload').disabled=true;}});
 const controls=value=>{for(const id of ['account-download','account-upload','knowledge-download','knowledge-upload','account-logout'])$(id).disabled=!value;$('account-form').hidden=value;};
 const replace=async data=>{Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,data);ignoreChange=true;try{callbacks.save();await callbacks.refresh();}finally{ignoreChange=false;}};
 async function action(fn){if(busy)return;busy=true;try{await fn();}catch(error){if(/SYNC_CONFLICT|版本衝突|conflict/i.test(error.message??'')){stale=true;autosync.stop();$('account-upload').disabled=true;status('另一台裝置已有更新：先匯出本機備份，再下載雲端紀錄。沒有覆寫雲端資料。');}else{status(error.message);if(logged&&!stale)autosync.start();}}finally{busy=false;}}
 async function applyKnowledge(packageUnits){validateKnowledge(packageUnits);await callbacks.setKnowledge(packageUnits);await callbacks.refresh();}
 async function reconcileKnowledge(){
  let local=callbacks.getKnowledge();validateKnowledge(local);
  const remote=await client.loadKnowledgePackage();
  if(!remote){knowledgeVersion=0;if(local.length){knowledgeVersion=await client.saveKnowledgePackage(local,0);kstatus('已把此帳號的知識包同步到雲端（'+local.length+' 筆）。');}else kstatus('雲端還沒有知識包；匯入後可同步。');return;}
  knowledgeVersion=remote.version;
  if(!local.length){await applyKnowledge(remote.units);kstatus('已下載雲端知識包（'+remote.units.length+' 筆）。');return;}
  const remoteById=new Map(remote.units.map(u=>[u.id,u])),localById=new Map(local.map(u=>[u.id,u]));
  const conflicts=[...localById].filter(([id,u])=>remoteById.has(id)&&JSON.stringify(remoteById.get(id))!==JSON.stringify(u)).map(([id])=>id);
  if(conflicts.length){knowledgeStale=true;kstatus('同一知識 ID 在兩台裝置內容不同（'+conflicts.length+' 筆）。保留兩邊版本，請先匯出本機包，再手動下載或整理後同步。');return;}
  const merged=[...remote.units,...local.filter(u=>!remoteById.has(u.id))];
  if(merged.length!==remote.units.length){await applyKnowledge(merged);knowledgeVersion=await client.saveKnowledgePackage(merged,knowledgeVersion);kstatus('已合併並同步 '+merged.length+' 筆知識單元。');}
  else {await applyKnowledge(remote.units);kstatus('已確認知識包同步（'+remote.units.length+' 筆）。');}
 }
 async function activate(user,cachedState=null){
  callbacks.setStorageKey('college-os-account-'+user.id);
  let remote=null;try{remote=await client.load();}catch{}
  let local=cachedState; if(!local){try{local=JSON.parse(localStorage.getItem('college-os-account-'+user.id));}catch{}}
  const loaded=local?validateBackup(JSON.stringify(local)):remote?validateBackup(JSON.stringify(remote)):empty();
  stale=!!local&&Number(local.cloudVersion??0)!==client.version;
  if(!local)loaded.cloudVersion=client.version;
  await replace(loaded);logged=true;controls(true);callbacks.setAuthenticated(true);
  autosync.start();
  if(stale){$('account-upload').disabled=true;status('本機與雲端紀錄版本不同。請先匯出本機備份，再下載雲端；目前禁止覆寫。');}
  else status('已登入，個人紀錄會自動同步。');
  $('storage-mode').textContent='目前帳號：'+(user.email??'已登入')+'。修改後會自動同步。';
  await reconcileKnowledge();
 }
 document.addEventListener('college-saved',()=>{if(logged&&!ignoreChange&&!stale)autosync.schedule();});
 document.addEventListener('college-knowledge-changed',()=>{if(logged&&!ignoreChange&&!knowledgeStale)$('knowledge-upload').click();});
 window.addEventListener('online',()=>{if(logged&&!stale)autosync.schedule();});
 $('storage-mode').textContent='Email 模式：請先登入。未登入時不載入個人紀錄。';
 $('account-form').onsubmit=e=>{e.preventDefault();action(async()=>{const user=await client.signIn($('account-email').value.trim(),$('account-password').value);$('account-password').value='';await activate(user);});};
 $('account-signup').onclick=()=>action(async()=>{if(!$('account-form').reportValidity())return;await client.signUp($('account-email').value.trim(),$('account-password').value);$('account-password').value='';status('請檢查信箱並完成帳號驗證，再回來登入。');});
 $('account-reset').onclick=()=>action(async()=>{if(!$('account-email').reportValidity())return;await client.resetPassword($('account-email').value.trim());status('如果此 Email 有帳號，將收到重設密碼信。');});
 $('account-download').onclick=()=>action(async()=>{if(!confirm('以雲端資料取代本機紀錄？請先匯出備份。'))return;autosync.stop();await client.refresh();const remote=await client.load();if(remote){const loaded=validateBackup(JSON.stringify(remote));loaded.cloudVersion=client.version;stale=false;await replace(loaded);$('account-upload').disabled=false;status('已下載雲端紀錄。');}else status('雲端尚無紀錄，可以立即同步目前紀錄。');autosync.start();});
 $('account-upload').onclick=()=>action(async()=>{autosync.stop();await client.refresh();if(stale)throw Error('SYNC_CONFLICT');const payload=structuredClone(state);delete payload.privateUnits;state.cloudVersion=await client.save(payload);stale=false;autosync.start();ignoreChange=true;try{callbacks.save();}finally{ignoreChange=false;}status('私人紀錄已同步。');});
 $('knowledge-upload').onclick=()=>action(async()=>{const units=callbacks.getKnowledge();validateKnowledge(units);const next=await client.saveKnowledgePackage(units,knowledgeVersion);knowledgeVersion=next;knowledgeStale=false;kstatus('知識包已同步到私人雲端（'+units.length+' 筆）。');});
 $('knowledge-download').onclick=()=>action(async()=>{if(!confirm('以雲端知識包取代此裝置的知識包？如要保留兩邊內容，請先匯出本機知識包。'))return;const remote=await client.loadKnowledgePackage();if(!remote){kstatus('雲端還沒有知識包。');return;}await applyKnowledge(remote.units);knowledgeVersion=remote.version;knowledgeStale=false;kstatus('已下載 '+remote.units.length+' 筆知識單元。');});
 $('account-logout').onclick=()=>action(async()=>{autosync.stop();logged=false;await client.signOut().catch(()=>{});callbacks.setStorageKey('college-os-guest');await replace(empty());callbacks.setAuthenticated(false);controls(false);kstatus('登出後，知識包仍依帳號分開保存在此瀏覽器。');$('storage-mode').textContent='已登出。此瀏覽器仍保留帳號的本機備份，與其他帳號隔離。';status('已登出。');});
 const recoveryFlow=location.hash.includes('type=recovery');
 if(recoveryFlow){const hash=location.hash;history.replaceState(null,'',location.pathname+location.search);await action(async()=>{if(await client.recoverFromHash(hash)){$('account-recovery').hidden=false;$('account-form').hidden=true;status('請設定新密碼。');}});}
 $('account-recovery').onsubmit=e=>{e.preventDefault();action(async()=>{await client.changePassword($('recovery-password').value);$('recovery-password').value='';await client.signOut();$('account-recovery').hidden=true;controls(false);status('密碼已更新，請重新登入。');});};
 if(!recoveryFlow){await action(async()=>{const user=await client.restoreSession();if(user)await activate(user);});}
}
