import {createCloudClient} from './cloud.mjs';
import {createAutosync} from './autosync.mjs';
import {validateBackup,migrate} from './life.mjs';

export async function mountAccount(config,state,callbacks){
 const client=config.enabled?createCloudClient(config):null;
 if(!client)return;
 const container=document.querySelector('#settings .panel:last-child');
 container.innerHTML='<h2>Email 登入與跨裝置同步</h2><p>登入後，個人紀錄會在每次修改後經 HTTPS 自動同步；知識包仍留在各裝置。第一次連接前請保留備份。</p><form id="account-form" class="form-grid"><label>Email<input id="account-email" type="email" autocomplete="username" required></label><label>密碼<input id="account-password" type="password" autocomplete="current-password" minlength="8" required></label><button class="primary">登入</button><button id="account-signup" type="button" class="secondary">建立帳號</button><button id="account-reset" type="button" class="secondary">寄送重設密碼信</button></form><div class="actions"><button id="account-download" class="secondary" disabled>下載雲端紀錄</button><button id="account-upload" class="primary" disabled>立即同步</button><button id="account-logout" class="secondary" disabled>登出</button></div><p id="account-status" role="status">請先登入。</p><form id="account-recovery" class="form-grid" hidden><label>新密碼<input id="recovery-password" type="password" autocomplete="new-password" minlength="8" required></label><button class="primary">更新密碼</button></form>';
 const $=id=>document.getElementById(id),status=t=>$('account-status').textContent=t;
 const empty=()=>migrate({tasks:{},wrong:[],mastery:{},events:[]});
 let busy=false,stale=false,logged=false,ignoreChange=false;
 const autosync=createAutosync({client,getState:()=>state,saveLocal:()=>{ignoreChange=true;try{callbacks.save();}finally{ignoreChange=false;}},status,onConflict:()=>{stale=true;$('account-upload').disabled=true;}});
 const replace=async data=>{Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,data);ignoreChange=true;try{callbacks.save();await callbacks.refresh();}finally{ignoreChange=false;}};
 async function action(fn){if(busy)return;busy=true;try{await fn();}catch(err){if(/SYNC_CONFLICT|版本衝突|conflict/i.test(err.message??'')){stale=true;autosync.stop();$('account-upload').disabled=true;status('另一台裝置已有更新：先匯出本機備份，再下載雲端紀錄。沒有覆寫任何雲端資料。');}else{status(err.message);if(logged&&!stale)autosync.start();}}finally{busy=false;}}
 function controls(isLogged){['account-download','account-upload','account-logout'].forEach(id=>$(id).disabled=!isLogged);$('account-form').hidden=isLogged;}
 document.addEventListener('college-saved',()=>{if(logged&&!ignoreChange&&!stale)autosync.schedule();});
 window.addEventListener('online',()=>{if(logged&&!stale)autosync.schedule();});
 $('storage-mode').textContent='Email 模式：請先登入。未登入時不載入個人紀錄。';
 $('account-form').onsubmit=e=>{e.preventDefault();action(async()=>{
  const user=await client.signIn($('account-email').value.trim(),$('account-password').value);$('account-password').value='';callbacks.setStorageKey('college-os-account-'+user.id);
  const remote=await client.load();let cached=null;try{cached=JSON.parse(localStorage.getItem('college-os-account-'+user.id));}catch{}
  const loaded=cached?validateBackup(JSON.stringify(cached)):remote?validateBackup(JSON.stringify(remote)):empty();
  stale=!!cached&&Number(cached.cloudVersion??0)!==client.version;if(!cached)loaded.cloudVersion=client.version;
  await replace(loaded);logged=true;autosync.start();controls(true);callbacks.setAuthenticated(true);$('account-upload').disabled=stale;
  status(cached?stale?'本機與雲端版本不同。請先匯出本機備份，再下載雲端；目前禁止覆寫。':'已載入本機帳號紀錄，之後修改會自動同步。':'已登入並載入私人紀錄，之後修改會自動同步。');
  $('storage-mode').textContent='目前帳號：'+user.email+'。修改後會自動同步；也可按「立即同步」。';
 });};
 $('account-signup').onclick=()=>action(async()=>{if(!$('account-form').reportValidity())return;await client.signUp($('account-email').value.trim(),$('account-password').value);$('account-password').value='';status('請檢查信箱並完成帳號驗證，再回來登入。');});
 $('account-reset').onclick=()=>action(async()=>{if(!$('account-email').reportValidity())return;await client.resetPassword($('account-email').value.trim());status('如果此 Email 有帳號，將收到重設密碼信。');});
 $('account-download').onclick=()=>action(async()=>{if(!confirm('以下載的雲端資料取代本機紀錄？請先匯出備份。'))return;autosync.stop();await client.refresh();const remote=await client.load();if(remote){const loaded=validateBackup(JSON.stringify(remote));loaded.cloudVersion=client.version;stale=false;await replace(loaded);$('account-upload').disabled=false;status('已下載雲端紀錄。後續修改會自動同步。');}else status('雲端尚無紀錄，可以立即同步目前紀錄。');autosync.start();});
 $('account-upload').onclick=()=>action(async()=>{autosync.stop();await client.refresh();if(stale)throw Error('SYNC_CONFLICT');const payload=structuredClone(state);delete payload.privateUnits;state.cloudVersion=await client.save(payload);stale=false;autosync.start();ignoreChange=true;try{callbacks.save();}finally{ignoreChange=false;}status('私人紀錄已同步。知識包保留在此裝置，請另行匯入其他裝置。');});
 $('account-logout').onclick=()=>action(async()=>{autosync.stop();logged=false;await client.signOut().catch(()=>{});callbacks.setStorageKey('college-os-guest');await replace(empty());callbacks.setAuthenticated(false);controls(false);$('storage-mode').textContent='已登出。此瀏覽器仍保留帳號的本機備份，與其他帳號隔離。';status('已登出。');});
 if(location.hash.includes('type=recovery')){const hash=location.hash;history.replaceState(null,'',location.pathname+location.search);await action(async()=>{if(await client.recoverFromHash(hash)){$('account-recovery').hidden=false;$('account-form').hidden=true;status('請設定新密碼。');}});}
 $('account-recovery').onsubmit=e=>{e.preventDefault();action(async()=>{await client.changePassword($('recovery-password').value);$('recovery-password').value='';await client.signOut();$('account-recovery').hidden=true;controls(false);status('密碼已更新，請重新登入。');});};
}
