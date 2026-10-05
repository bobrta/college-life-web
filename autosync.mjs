const cloudPayload=state=>{const payload=structuredClone(state);delete payload.privateUnits;return payload;};
const comparable=state=>{const payload=cloudPayload(state);delete payload.cloudVersion;return JSON.stringify(payload);};

export function createAutosync({client,getState,saveLocal,status,onConflict,delay=700}){
 let timer=null,active=false,running=false,blocked=false;
 const clear=()=>{if(timer!==null){clearTimeout(timer);timer=null;}};
 const run=async()=>{
  timer=null;if(!active||blocked||running)return;
  running=true;
  try{
   await client.refresh();
   const sent=comparable(getState()),payload=cloudPayload(getState());
   const version=await client.save(payload);
   if(!active)return;
   getState().cloudVersion=version;saveLocal();status('已自動同步私人紀錄。');
   if(comparable(getState())!==sent)schedule();
  }catch(error){
   if(/SYNC_CONFLICT|版本衝突|conflict/i.test(error.message??'')){blocked=true;onConflict?.();status('另一台裝置已更新資料。自動上傳已暫停；先匯出本機備份，再下載雲端紀錄。');}
   else status('自動同步暫時失敗，資料仍保留在此裝置；網路恢復或再次修改時會重試。');
  }finally{running=false;}
 };
 function schedule(){if(!active||blocked)return;clear();timer=setTimeout(run,delay);}
 return {
  start(){active=true;blocked=false;},
  stop(){active=false;clear();},
  schedule,
  get blocked(){return blocked;}
 };
}
