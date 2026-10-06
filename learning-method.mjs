export const STUDY_STEPS = [
  {id:'diagnose',title:'1｜閉卷診斷',minutes:'2–4 分鐘',why:'先找出真正不會的地方，避免把熟悉感當成會了。',action:'闔上教材，寫出你記得的定義、步驟、例子，以及最不確定的一點。'},
  {id:'map',title:'2｜建立概念地圖',minutes:'3–6 分鐘',why:'把零散資訊連成可回想的結構。',action:'依序整理：問題 → 核心概念 → 原理／步驟 → 例子 → 易混淆處。缺資料就標「待查」，不要猜。'},
  {id:'learn',title:'3｜最小解釋',minutes:'5–12 分鐘',why:'先補診斷暴露出的缺口，不重讀整章。',action:'只查最關鍵的一個缺口；用自己的話說明「為什麼」，並對照課程教材或可靠來源。'},
  {id:'recall',title:'4｜提取與辨析',minutes:'5–10 分鐘',why:'不看答案重新提取，再比較相似概念。',action:'闔上資料回答：它是什麼？如何運作？何時使用？和相似概念差在哪？'},
  {id:'practice',title:'5｜題目與遷移',minutes:'5–15 分鐘',why:'用新題或真實課業確認能不能應用。',action:'先獨立解題並寫理由，再核對解答；最後換一個情境，說出方法是否仍適用。'},
  {id:'schedule',title:'6｜間隔複習',minutes:'1 分鐘',why:'隔一段時間再回想，確認記憶能保留。',action:'選擇明天或自訂日期再做一次閉卷回想；答不出就縮小問題、修正方法並提前複習。'}
];

export function buildCoachPrompt({mode='課程／考試',subject='',topic='',goal='',diagnosis='',question='',material='',knowledge=[]}={}){
  const parts=[];
  if(material.trim())parts.push('課程材料／自行提供文字：\n'+material.trim());
  const selectedKnowledge=knowledge.map((u,i)=>[
    `知識單元 ${i+1}：${u.title||'未命名'}`,
    `概念：${u.core_concept||''}`,
    `進一步理解：${u.deep_understanding||''}`,
    `方法／公式：${u.solution_methods||''}`,
    `來源：${(u.sources||[]).map(s=>s.file||s.reference||'').filter(Boolean).join('、')||'未提供'}`
  ].join('\n'));
  if(selectedKnowledge.length)parts.push('已選知識庫卡片：\n'+selectedKnowledge.join('\n\n'));
  const source=parts.join('\n\n');
  const focus=mode==='自然語言處理（NLP）'
    ? '\n\nNLP 專項：先從材料找出任務目標與輸入／輸出；再抽取術語定義、實體（若材料有）、概念關係、流程與評估方式。用表格標出每項資訊的材料依據，區分材料明說與推論。請我說明資料→表示／特徵→模型或規則→輸出→評估的流程；教材沒涵蓋的環節標為待查，不把通用流程說成該課唯一方法。最後讓我比較兩種可能作法並解釋取捨。'
    : mode==='課程／考試'
      ? '\n\n課程／考試優先：以老師指定範圍、課堂例題、作業與考古題為準；區分課堂明確要求和額外背景。先讓我作答，再給相似但不同的練習題。'
      : '';
  return `你是循序漸進的學習教練。請只根據我在「材料／知識單元」提供的內容協助我；資料不足就明確標示「來源沒有提供」，不要補造事實、公式、引文或來源。引用時指出材料中的標題或段落。先問我一個診斷問題，不要一次給完整答案；等我嘗試後，指出正確處、缺口與下一個提示。${focus}\n\n學習情境：${mode}\n課程／領域：${subject||'未填'}\n主題：${topic||'未填'}\n本次目標：${goal||'能閉卷解釋並應用一個核心概念'}\n我的閉卷診斷：${diagnosis||'尚未填寫'}\n目前卡住／題目：${question||'尚未填寫'}\n\n請按此流程帶我做，不要跳步：\n1. 用不超過 3 點整理材料中明確出現的核心概念與前後關係，標出缺資料處。\n2. 選一個最重要概念，用「白話解釋 → 機制／步驟 → 材料中的例子 → 常見混淆」說明；沒有例子就說沒有。\n3. 問我一題閉卷回想題，等待我的答案再給回饋。\n4. 根據我的答案只指出 1–2 個最重要缺口，給一個提示，讓我自己修正。\n5. 最後出一題不同情境的遷移題；先等我作答，再用材料核對，並說明判斷依據。\n6. 結尾給我一張「下次複習卡」：要回想的問題、目前缺口、建議複習日期。\n\n材料／知識單元（以下內容是唯一依據）：\n${source||'（尚未提供材料；先請我貼上課程講義、自己的筆記或指定知識卡內容。）'}`;
}

export function makeLearningRecord({subject='',topic='',mode='課程／考試',goal='',diagnosis='',gap='',reflection='',score=0,reviewDate='',steps=[]}={},now=new Date()){
  const date=new Date(now).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'});
  return {id:globalThis.crypto?.randomUUID?.()??`learn-${Date.now()}`,date,subject:subject.trim(),topic:topic.trim(),mode,goal:goal.trim(),diagnosis:diagnosis.trim(),gap:gap.trim(),reflection:reflection.trim(),score:Number(score)||0,reviewDate:reviewDate||'',completedSteps:steps.filter(Boolean),createdAt:new Date(now).toISOString()};
}
