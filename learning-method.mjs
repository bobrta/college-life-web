export const STUDY_STEPS = [
  {id:'diagnose',title:'1｜先測，不先重讀',minutes:'2 分鐘',why:'先知道目前差在哪，才不會把眼熟誤認成會。',action:'闔上教材，寫 1–3 句：這個考點是什麼？我記得哪個步驟？最不確定哪裡？'},
  {id:'map',title:'2｜對照老師範圍',minutes:'3–5 分鐘',why:'只整理本章核心，不重抄整份投影片。',action:'打開老師材料，圈一個考點、一個例題和一個不懂的地方；沒寫在來源裡就標「待問／待查」。'},
  {id:'learn',title:'3｜只補一個缺口',minutes:'5–10 分鐘',why:'從最大卡點下手，避免同時開太多資料。',action:'先看老師例題或講義；仍不懂時再產生 AI 提示，請它用來源解釋一個概念並先給提示。'},
  {id:'recall',title:'4｜闔上資料重講',minutes:'3–5 分鐘',why:'確認自己能否重建，不是照著答案念。',action:'不看筆記回答：定義是什麼？為什麼用這方法？步驟和適用條件是什麼？'},
  {id:'practice',title:'5｜先做老師題，再變化',minutes:'5–15 分鐘',why:'先穩住課內基本分，再檢查能否遷移。',action:'獨立完成一題老師例題／作業／指定題庫並寫理由；核對後標記錯因，再改一個條件重做。'},
  {id:'schedule',title:'6｜排一次延後回測',minutes:'1 分鐘',why:'隔天不看答案再做，才知道是否真的記住。',action:'預設排明天；答對且能解釋可再拉長間隔，答錯就縮小問題、修正後提早再測。'}
];

export function buildCoachPrompt({mode='課程／考試',subject='',topic='',goal='',diagnosis='',question='',material='',knowledge=[],duration='25'}={}){
  const parts=[];
  if(material.trim())parts.push('課程材料／自行提供文字：\n'+material.trim());
  const selectedKnowledge=knowledge.map((u,i)=>{
    const provenance=`來源：${(u.sources||[]).map(s=>s.file||s.reference||'').filter(Boolean).join('、')||'未提供'}`;
    if(u.kind==='question')return [`題庫題目 ${i+1}：${u.title||'未命名'}`,`題幹：${u.question||'未提供'}`,`選項：${u.options||'未提供'}`,`正解（先不要透露）：${u.answer||'未提供'}`,`解析（等我作答後再用）：${u.explanation||'未提供'}`,provenance].join('\n');
    return [`知識單元 ${i+1}：${u.title||'未命名'}`,`概念：${u.core_concept||''}`,`進一步理解：${u.deep_understanding||''}`,`方法／公式：${u.solution_methods||''}`,provenance].join('\n');
  });
  if(selectedKnowledge.length)parts.push('已選知識庫卡片：\n'+selectedKnowledge.join('\n\n'));
  const source=parts.join('\n\n');
  const focus=mode==='自然語言處理（NLP）'
    ? '\n\nNLP 專項：先從材料找出任務目標與輸入／輸出；再抽取術語定義、實體（若材料有）、概念關係、流程與評估方式。用表格標出每項資訊的材料依據，區分材料明說與推論。請我說明資料→表示／特徵→模型或規則→輸出→評估的流程；教材沒涵蓋的環節標為待查，不把通用流程說成該課唯一方法。最後讓我比較兩種可能作法並解釋取捨。'
    : mode==='課程／考試'
      ? '\n\n課程／考試優先：資料排序為老師公告的範圍與要求 → 課堂投影片／筆記 → 老師例題、作業和指定題庫 → 官方或歷屆考題。先練老師要求的基本題型；不得擅自把高難度額外內容當成本課考點。若為計算題，先辨認已知、要求、符號和單位，說明選公式的理由，再一次問我一個解題步驟，不跳步。若為管理等概念課，先整理概念定義、上位架構、相似概念差異與情境例子。解題時先等我作答，再核對題意、概念／公式、步驟和答案。若材料附有題庫正解，先把正解藏住，只用題幹問我作答；我答完才依正解與解析核對。錯誤回饋請標記主因：概念不懂、記不起來、題意看錯、公式／計算、步驟不完整或時間壓力。'
      : '\n\n知識理解優先：先挑一個概念說清楚定義、原因、例子、反例與適用條件；再讓我自己用新例子說明，不要只給摘要。';
  return `你是我的循序式學習教練。本輪約 ${duration} 分鐘。只根據「材料／知識單元」協助我；資料沒有寫就標「材料未提供」，不補造事實、公式、引文或來源。引用時指出材料標題或段落。不要替我完成作業，也不要一次傾倒整章答案；一次問一個問題，停下來等我回答。${focus}\n\n學習情境：${mode}\n課程／領域：${subject||'未填'}\n主題／單元：${topic||'未填'}\n本次完成條件：${goal||'能閉卷說明一個核心概念並完成一道基本題'}\n我的閉卷診斷：${diagnosis||'尚未填寫'}\n目前卡住／題目：${question||'尚未填寫'}\n\n請依順序帶我做，每一步等我回答後才進下一步：\n1. 用最多 3 點標出來源裡最重要的考點／概念，並指出來源不足處。\n2. 只教我最關鍵的一個缺口：白話定義 → 為什麼／怎麼做 → 來源裡的例子 → 容易混淆處。沒有例子就直說。\n3. 出一個閉卷回想問題；收到我的回答後，先指出答對的部分，再用來源說明一個待補處。\n4. 給一個提示讓我自己修正；不要直接代答。\n5. 讓我先獨立解一題老師／題庫的基本題型，再給一題只改一個條件的變化題；有附正解時先藏答案，等我作答後才核對。\n6. 結束時輸出短回顧：我已會什麼、錯因、下一次要回想的問題、建議複習日（依我選的日期）。\n\n材料／知識單元（以下內容是唯一依據）：\n${source||'（尚未提供材料；請先貼課堂講義、自己的筆記或勾選知識卡。）'}`;
}

export function makeLearningRecord({subject='',topic='',mode='課程／考試',goal='',diagnosis='',gap='',reflection='',score=0,reviewDate='',steps=[]}={},now=new Date()){
  const date=new Date(now).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'});
  return {id:globalThis.crypto?.randomUUID?.()??`learn-${Date.now()}`,date,subject:subject.trim(),topic:topic.trim(),mode,goal:goal.trim(),diagnosis:diagnosis.trim(),gap:gap.trim(),reflection:reflection.trim(),score:Number(score)||0,reviewDate:reviewDate||'',completedSteps:steps.filter(Boolean),createdAt:new Date(now).toISOString()};
}
