'use strict';
const $=s=>document.querySelector(s), B=window.BANK, STORE='spic2026-bank-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state={records:{},favorites:{},keys:{},edits:{},notes:{},timers:{},last:null},storageOK=true;
try{const s=JSON.parse(localStorage.getItem(STORE));if(s&&s.records)state={...state,...s}}catch(e){storageOK=false}
let view='practice',active=state.last||B.questions[0]?.id,filtered=[],selected=[],submitted=false,pageIndex=0;
const viewStatuses={practice:'new',wrong:'',favorite:''};
let questionClock={id:null,startedAt:null},lastTimerSave=0;
const names=Object.fromEntries(B.papers.map(p=>[p.id,p.label]));const byId=Object.fromEntries(B.questions.map(q=>[q.id,q]));
const duplicateGroups=B.duplicateGroups||[];
const duplicateById=new Map(duplicateGroups.flatMap(g=>g.members.map(id=>[id,g])));
function hasPriorAttempt(id){return !!state.records[id]||($('#dedup').checked&&(duplicateById.get(id)?.members||[]).some(k=>state.records[k]))}
function deduplicateQuestions(rows){
 if(!$('#dedup').checked)return rows;
 const picked=new Map();
 for(const q of rows){const g=duplicateById.get(q.id),groupKey=g?.id||q.id,previous=picked.get(groupKey);if(!previous||q.id===active||(previous.id!==active&&q.id===g?.representative))picked.set(groupKey,q)}
 return [...picked.values()];
}
function duplicateSources(q){const g=duplicateById.get(q.id);if(!g)return '';return `<details class="duplicateSources"><summary>同题共有 ${g.members.length} 个来源 · 查看其他版本</summary><p class="hint">题干和选项内容相同、仅选项顺序不同，也归为同题。作答按当前版本的选项和答案判断；原有记录分别保留。开启“隐藏重复题”时，未作答列表会跳过已做过的同题。</p>${q.duplicateProofread?`<p class="hint">已对照 ${esc(g.proofreadSource||q.duplicateProofread.source)} 校正题干及选项，选项按当前试卷排列。</p>${q.duplicateProofread.note?`<p class="reviewReason">${esc(q.duplicateProofread.note)}</p>`:''}`:''}${g.answerVariants?.length?'<p class="reviewReason">各来源参考答案存在分歧，当前保留本卷答案；题目内容相同，仍按重复题处理。</p>':''}<div class="actions">${g.members.filter(id=>id!==q.id).map(id=>{const other=getq(id);return `<button data-duplicate-open="${esc(id)}">${esc(names[other.paper])} · 第 ${other.page} 页 · ${esc(id)}${state.records[id]?' · '+learningLabel(state.records[id]):''}</button>`}).join('')}</div></details>`}


function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',3500)}
function save(){try{localStorage.setItem(STORE,JSON.stringify(state))}catch(e){storageOK=false;toast('浏览器未能保存，请导出学习记录备份。')}stats()}

function formatDuration(ms){const seconds=Math.floor(Math.max(0,ms)/1000),h=Math.floor(seconds/3600),m=Math.floor(seconds/60)%60,s=seconds%60;return (h?h+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
function elapsedFor(id){const t=state.timers[id];return (t?.elapsedMs||0)+(questionClock.id===id&&questionClock.startedAt!==null?Math.max(0,performance.now()-questionClock.startedAt):0)}
function checkpointTimer(){const id=questionClock.id;if(id&&questionClock.startedAt!==null){state.timers[id].elapsedMs=elapsedFor(id);questionClock.startedAt=performance.now()}}
function pauseQuestionTimer(){checkpointTimer();questionClock.startedAt=null}
function syncQuestionTimer(q){
 const id=['practice','wrong','favorite'].includes(view)&&q&&filtered.some(x=>x.id===q.id)&&q.type!=='复合题材料'?q.id:null;
 if(id!==questionClock.id){
  pauseQuestionTimer();save();questionClock={id,startedAt:null};
  if(id){const t=state.timers[id];if(!t||t.finished)state.timers[id]={elapsedMs:0,finished:false}}
 }
 if(id&&!state.timers[id].finished&&!document.hidden&&questionClock.startedAt===null)questionClock.startedAt=performance.now();
}
function restartQuestionTimer(){const id=questionClock.id;if(!id)return;state.timers[id]={elapsedMs:0,finished:false};questionClock.startedAt=document.hidden?null:performance.now();updateQuestionTimer()}
function finishQuestionTimer(id){if(questionClock.id!==id)return state.records[id]?.durationMs;pauseQuestionTimer();state.timers[id].finished=true;updateQuestionTimer();return Math.round(state.timers[id].elapsedMs)}
function updateQuestionTimer(){
 const el=$('#questionTimer');if(!el||!questionClock.id)return;
 const id=questionClock.id,t=state.timers[id],previous=state.records[id]?.durationMs;
 $('#timerLabel').textContent=t.finished?'本次用时':document.hidden?'本题用时（已暂停）':'本题用时';
 $('#timerValue').textContent=formatDuration(elapsedFor(id));
 $('#previousTime').textContent=!t.finished&&Number.isFinite(previous)?'上次作答 '+formatDuration(previous):'';
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseQuestionTimer();save()}else syncQuestionTimer(active&&getq(active));updateQuestionTimer()});
window.addEventListener('pagehide',()=>{pauseQuestionTimer();save()});
window.addEventListener('pageshow',()=>{syncQuestionTimer(active&&getq(active));updateQuestionTimer()});
setInterval(()=>{updateQuestionTimer();if(questionClock.startedAt!==null&&performance.now()-lastTimerSave>5000){checkpointTimer();save();lastTimerSave=performance.now()}},250);

function getq(id){return {...byId[id],...(state.edits[id]||{})}}
function key(id){return state.keys[id]||byId[id]?.answer||''}
function textNeedsReview(q){if(q.photoProofread?.pendingReason)return true;if(q.duplicateProofread?.status==='partial'&&!q.textReviewed)return true;if(q.excluded||q.type==='复合题材料'||q.textReviewed||(q.imageBased&&!q.sourceReview))return false;if(q.sourceReview)return true;if(q.practiceImage&&q.imageReviewed)return false;const expected=q.type==='判断题'?['A','B']:['A','B','C','D'];const ks=q.options.map(o=>o.key);return !q.stem?.trim()||q.type==='待核对'||expected.some(k=>!q.options.some(o=>o.key===k&&o.text.trim()))||new Set(ks).size!==ks.length||q.options.some(o=>!o.text.trim())||(!q.optionsReviewed&&typeof q.confidence==='number'&&q.confidence<0.88)}
function keyLabel(id){return state.keys[id]?'个人参考答案':byId[id]?.answerSource==='补充解答'?'补充参考答案':'原卷参考答案'}
function reconcileAnswers(){let changed=0;for(const [id,r] of Object.entries(state.records)){const k=key(id);if(!k||!r?.selected?.length||['selfRight','selfWrong'].includes(r.result))continue;const wrong=r.selected.slice().sort().join('')!==k,result=wrong?'wrong':'correct';if(r.result!==result||r.wrong!==wrong){r.result=result;r.wrong=wrong;r.gradedWith=k;r.answerEdition=B.answerEdition;changed++}}return changed}
function isMastered(r){return !!r&&!r.wrong&&['correct','selfRight'].includes(r.result)}
function learningLabel(r){return isMastered(r)?'✓ 已掌握':r?.wrong?'需重练':r?'待确认对错':'未作答'}
function stats(){const rs=Object.entries(state.records).filter(([id])=>byId[id]&&!byId[id].excluded).map(([,r])=>r);$('#doneCount').textContent=rs.length;$('#masteredCount').textContent=rs.filter(isMastered).length;$('#wrongCount').textContent=rs.filter(r=>r.wrong).length;$('#favCount').textContent=Object.entries(state.favorites).filter(([id,v])=>v&&byId[id]&&!byId[id].excluded).length}
function questionCategories(q){return [...new Set([q.category,...(q.categories||[])].filter(Boolean))]}
function matches(q){if(q.excluded)return false;const term=$('#search').value.trim().toLowerCase(),r=state.records[q.id],s=$('#status').value;return (!$('#year').value||q.year==$('#year').value)&&(!$('#paper').value||q.paper==$('#paper').value)&&(!$('#kind').value||q.type==$('#kind').value||questionCategories(q).includes($('#kind').value))&&(!term||[q.stem,...q.options.map(o=>o.text),q.id,q.number].join(' ').toLowerCase().includes(term))&&(!s||(s==='textReview'&&textNeedsReview(q))||(s==='new'&&!hasPriorAttempt(q.id))||(s==='done'&&r)||(s==='key'&&key(q.id))||(s==='missingKey'&&q.type!=='复合题材料'&&!key(q.id))||(s==='mastered'&&isMastered(r))||(s==='unmastered'&&q.type!=='复合题材料'&&!isMastered(r))||(s==='pending'&&r&&!r.wrong&&!isMastered(r)))}
function refresh(){filtered=deduplicateQuestions(B.questions.map(q=>getq(q.id)).filter(q=>matches(q)&&(view!=='wrong'||state.records[q.id]?.wrong)&&(view!=='favorite'||state.favorites[q.id])));if(!filtered.some(q=>q.id===active))active=filtered[0]?.id;renderList();renderCard();renderPairs();renderPage();renderReview();renderDocuments();stats()}
function renderList(){ $('#resultCount').textContent=filtered.length+' 条内容';$('#list').innerHTML=filtered.map(q=>`<button class="qrow ${q.id===active?'selected':''}" data-id="${q.id}"><small>${names[q.paper]} · 第 ${q.page} 页 · 原题 ${esc(q.number)} ${state.favorites[q.id]?'★':''} ${state.records[q.id]?learningLabel(state.records[q.id]):''}</small><p>${esc(q.stem||'图形或文字待核对，请看原图')}</p></button>`).join('')||'<p class="empty">暂无符合条件的题目</p>';$('#list').querySelectorAll('button').forEach(b=>b.onclick=()=>choose(b.dataset.id))}
function choose(id){active=id;state.last=id;save();renderList();renderCard()}
function openRelatedQuestion(id){
 if(!byId[id]||byId[id].excluded){toast('这道题已不在当前题库中');return}
 for(const name of ['search','year','paper','kind','status'])$('#'+name).value='';
 populatePapers();
 active=id;state.last=id;setView('practice');save();
 $('#card').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderCard(){const q=active&&getq(active);syncQuestionTimer(q);if(!q||!filtered.some(x=>x.id===q.id)){$('#card').innerHTML='<div class="empty">这里暂时没有题目。<br>试试调整筛选条件。</div>';return}selected=[...(state.records[q.id]?.selected||[])];submitted=!!state.records[q.id];const keys=key(q.id);const letters=[...new Set([...q.options.map(o=>o.key),...(q.type==='判断题'?['A','B']:['A','B','C','D'])])].sort();
$('#card').innerHTML=`<div class="cardtop"><div class="badges"><span class="badge">${esc(q.type)}</span>${questionCategories(q).map(c=>`<span class="badge">${esc(c)}</span>`).join('')}<span class="badge ${isMastered(state.records[q.id])?'':'gray'}">${learningLabel(state.records[q.id])}</span><span class="badge gray">${q.textDisplay?(q.textDisplay.pendingReason?'原卷局部内容缺失':q.textDisplay.source==='对照原图转写'?'文字已对照原图':'文字题干'):q.photoProofread?(q.photoProofread.pendingReason?'局部文字待辨认':q.photoProofread.complete?'文字已对照原图':'已修正识别文字'):q.duplicateProofread?(q.duplicateProofread.status==='verified'?'已对照清晰原图':'局部文字待辨认'):q.questionImages?'原题截图':q.practiceImage?(textNeedsReview(q)?'选项对应待确认':'图形截图已核对'):q.textReviewed?'文字已核对':q.sourceReview?'原图待确认':q.optionsReviewed?'选项已校正':textNeedsReview(q)?'文字待核对':'OCR 初稿'}</span><span class="badge gray">${keys?keyLabel(q.id):(q.solutionText?'已有解答 / 核查说明':'答案待确认')}</span></div><button id="fav" aria-label="收藏当前题目">${state.favorites[q.id]?'★ 已收藏':'☆ 收藏'}</button></div><div class="source">${names[q.paper]} · PDF 第 ${q.page} 页 · 原题号 ${esc(q.number)} · ${q.id}</div>${duplicateSources(q)}<div id="questionTimer" class="questionTimer" ${q.type==='复合题材料'?'hidden':''}><div><span id="timerLabel">本题用时</span> <strong id="timerValue" role="timer" aria-label="本题作答用时">00:00</strong><span id="previousTime" class="hint"></span></div><button id="restartTimer" title="开始新一轮作答计时">重新作答</button></div><div class="stem">${esc(q.stem||'该题文字未完整识别，请展开原图查看。')}</div><div id="options">${letters.map(k=>{const o=q.options.find(o=>o.key===k);return `<button class="option" data-key="${k}" aria-pressed="false"><strong>${k}</strong><span>${esc(q.scanText?'选择题图中 '+k+' 项':o?.text||(q.practiceImage?'原卷未显示此项与图形的对应关系':q.sourceReview?'原卷此项未显示完整，请对照上方原图':'此项请对照原图'))}</span></button>`}).join('')}</div><div class="actions"><button id="submit" class="primary">提交答案</button><button id="selfWrong">标记为错题</button><button id="selfRight">我答对了 · 记为掌握</button></div><div id="feedback" class="feedback" hidden></div><details ${($('#status').value==='textReview'||!q.stem||q.options.length<(q.type==='判断题'?2:4)||q.type==='待核对'||/图形|填入问号/.test(q.stem))?'open':''}><summary>查看题目原图 · 含原卷手写标记</summary><p class="hint">原卷标记可能直接显示答案。点击图片可在新窗口放大查看。</p><a href="${q.image}" target="_blank" rel="noopener"><img class="sourceimg" src="${q.image}" alt="${names[q.paper]}第${q.page}页题目原图"></a><button id="gotoPage">打开完整原页</button></details><details><summary>核实答案 / 校正题目 / 学习笔记</summary><div class="editgrid"><p class="hint">已录入原卷答案及补充解答，来源见题目标签。可填写个人答案（如 B 或 ACD）覆盖题库答案；留空保存可恢复使用题库答案。${q.answerNote?esc(q.answerNote):''}</p><div class="keyrow"><input id="answerKey" value="${esc(keys)}" placeholder="参考答案，例如 ACD" aria-label="参考答案"><button id="saveKey">保存答案</button></div><label>题干<textarea id="editStem">${esc(q.stem)}</textarea></label><label>选项（每行一项，例如 A. 内容）<textarea id="editOptions">${esc(q.options.map(o=>o.key+'. '+o.text.replace(/\n/g,' ')).join('\n'))}</textarea></label><button id="saveText">保存文字校正</button><label>我的笔记<textarea id="notes" placeholder="记录解法、疑问或答案来源…">${esc(state.notes[q.id]||'')}</textarea></label><button id="saveNote">保存笔记</button></div></details><div class="pager"><button id="prev" ${filtered[0]?.id===q.id?'disabled':''}>← 上一题</button><span class="hint">${filtered.findIndex(x=>x.id===q.id)+1} / ${filtered.length}</span><button id="next" ${filtered.at(-1)?.id===q.id?'disabled':''}>下一题 →</button></div>`;
$('#card').querySelectorAll('[data-duplicate-open]').forEach(button=>button.onclick=()=>openRelatedQuestion(button.dataset.duplicateOpen));
updateQuestionTimer();$('#restartTimer').onclick=()=>{restartQuestionTimer();selected=[];submitted=false;$('#feedback').hidden=true;paint();save()};
$('#fav').onclick=()=>{state.favorites[q.id]=!state.favorites[q.id];save();if(view==='favorite')refresh();else{renderList();renderCard()}};
$('#options').querySelectorAll('button').forEach(btn=>btn.onclick=()=>{if(state.timers[q.id]?.finished)restartQuestionTimer();const k=btn.dataset.key;if(q.type==='多选题'||(q.type==='待核对'&&key(q.id).length!==1)){selected=selected.includes(k)?selected.filter(x=>x!==k):[...selected,k]}else selected=[k];submitted=false;$('#feedback').hidden=true;paint()});
$('#submit').onclick=()=>{if(!selected.length){toast('请先选择答案');return}const k=key(q.id),ans=selected.slice().sort().join('');state.records[q.id]={selected:[...selected],wrong:k?ans!==k:!!state.records[q.id]?.wrong,result:k?(ans===k?'correct':'wrong'):'unknown',time:new Date().toISOString(),durationMs:finishQuestionTimer(q.id)};submitted=true;save();refresh();toast(k?(ans===k?'答对了，已掌握':'回答有误，已加入错题本'):'请核对答案；答对后点击“我答对了”')};
$('#selfWrong').onclick=()=>selfMark(true);$('#selfRight').onclick=()=>selfMark(false);
function selfMark(wrong){state.records[q.id]={selected:[...selected],wrong,result:wrong?'selfWrong':'selfRight',time:new Date().toISOString(),durationMs:finishQuestionTimer(q.id)};submitted=true;save();refresh();toast(wrong?'已加入错题本':'答对了，已掌握')}
$('#saveKey').onclick=()=>{const k=$('#answerKey').value.toUpperCase().replace(/[\s,，、]/g,'');if(k&&!/^[A-H]+$/.test(k)){toast('答案只能包含 A 至 H');return}const a=[...new Set(k)].sort().join('');if(a.length>1&&['单选题','判断题'].includes(q.type)){toast('这类题目只能录入一个答案');return}if(a)state.keys[q.id]=a;else delete state.keys[q.id];const effective=key(q.id),r=state.records[q.id];if(r?.selected?.length){r.wrong=effective?r.selected.slice().sort().join('')!==effective:false;r.result=effective?(r.wrong?'wrong':'correct'):'unknown'}save();refresh();toast(isMastered(state.records[q.id])?'答案已保存，这题已掌握':'答案已保存')};
$('#saveText').onclick=()=>{const lines=$('#editOptions').value.split('\n').filter(x=>x.trim());const options=[];for(const t of lines){const m=t.match(/^\s*([A-H])[.、．\s]+(.*)$/i);if(!m){toast('请按 A. 内容 的格式，每行填写一个选项');return}if(options.some(o=>o.key===m[1].toUpperCase())){toast('选项字母不能重复');return}options.push({key:m[1].toUpperCase(),text:m[2]})}state.edits[q.id]={stem:$('#editStem').value,options,textReviewed:true};save();refresh();toast('文字校正已保存，已移出待核对列表')};
$('#saveNote').onclick=()=>{state.notes[q.id]=$('#notes').value;save();toast('笔记已保存')};$('#gotoPage').onclick=()=>{pageIndex=B.pages.findIndex(p=>p.paper===q.paper&&p.page===q.page);setView('pages')};
$('#prev').onclick=()=>move(-1);$('#next').onclick=()=>move(1);paint();if(submitted)feedback();enhanceQuestion(q);
function feedback(){const r=state.records[q.id];if(!r)return;const k=key(q.id);$('#feedback').hidden=false;$('#feedback').className='feedback '+(isMastered(r)?'good':r.wrong?'bad':'');$('#feedback').textContent=r.result==='selfWrong'?'已自行标记为错题。':r.result==='selfRight'?'答对了，已掌握。' :k?`${r.result==='correct'?'答对了，已掌握':'回答有误，已加入错题本'} · 你的答案：${r.selected.slice().sort().join('')} · ${keyLabel(q.id)}：${k}`:'待确认对错：'+(q.answerNote||'原卷未辨认到完整、可明确对应的答案标注。')+'对照原图后，可自行确认对错或补录参考答案。'}
function paint(){$('#options').querySelectorAll('button').forEach(b=>{const k=b.dataset.key;b.className='option'+(selected.includes(k)?' selected':'')+(submitted&&key(q.id).includes(k)?' correct':'')+(submitted&&key(q.id)&&selected.includes(k)&&!key(q.id).includes(k)?' incorrect':'');b.setAttribute('aria-pressed',selected.includes(k))})}}
function move(d){const i=filtered.findIndex(q=>q.id===active);if(filtered[i+d])choose(filtered[i+d].id)}
function switchView(v){
 if(v!==view){viewStatuses[view]=$('#status').value;$('#status').value=viewStatuses[v]??''}
 setView(v);
}
function setView(v){
 if(v==='wrong')$('#kind').value='';
 for(const option of $('#status').options)option.disabled=v==='wrong'&&['new','mastered','pending'].includes(option.value);
 if($('#status').selectedOptions[0]?.disabled)$('#status').value='';
if(v==='review'){['search','status','kind','year'].forEach(id=>document.getElementById(id).value='');populatePapers();document.getElementById('paper').value='';}view=v;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('#practiceView').hidden=['duplicates','pages','review','documents'].includes(v);$('#duplicatesView').hidden=v!=='duplicates';$('#pagesView').hidden=v!=='pages';$('#reviewView').hidden=v!=='review';$('#documentsView').hidden=v!=='documents';$('#viewTitle').textContent={practice:'把每一道题，练扎实。',wrong:'错过的题，再练一次。',favorite:'把重点，留在这里。',duplicates:'相同的题，放在一起看。',pages:'回到原卷，核对细节。',review:'需要确认的题，集中在这里。',documents:'试卷与学习资料，都在这里。'}[v];refresh()}
function renderPairs(){
 if(view!=='duplicates')return;
 const groups=duplicateGroups.filter(g=>g.members.some(id=>matches(getq(id))));
 const candidates=(B.duplicateCandidates||[]).filter(p=>matches(getq(p.a))||matches(getq(p.b)));
 function source(id){const q=getq(id);return `<div><p>${esc(names[q.paper])} · 第 ${q.page} 页 · ${esc(id)}</p><p>${esc(q.stem)}</p><button data-open="${esc(id)}">去练习此题</button><details><summary>对照原图（可能含答案标记）</summary><img loading="lazy" src="${esc(q.image)}" alt="题目原图"></details></div>`}
 const confirmed=groups.map(g=>`<div class="pair"><div class="pairhead"><span class="badge">已确认同题 · ${g.members.length} 个来源</span><span>${g.crossFormat?'含图片版与文字版':'含不同试卷版本'}</span></div><div class="paircols">${source(g.representative)}<div><p>其他来源</p>${g.members.filter(id=>id!==g.representative).map(id=>`<details><summary>${esc(names[getq(id).paper])} · ${esc(id)}</summary>${source(id)}</details>`).join('')}</div></div></div>`).join('');
 const pending=candidates.map(p=>`<div class="pair"><div class="pairhead"><span class="badge gray">相似待核查 · 未隐藏</span><span>${p.flags?.includes('answerConflict')?'答案对应有差异，保留分别作答':'仍有数字、缺字或内容差异'}</span></div><div class="paircols">${source(p.a)}${source(p.b)}</div></div>`).join('');
 $('#pairs').innerHTML=`<p class="hint">当前筛选：${groups.length} 组已确认重复题，${candidates.length} 对相似候选。<a href="重复题核对记录.html" target="_blank" rel="noopener">查看全库核对记录 ↗</a></p>`+(confirmed||'<p class="empty">当前筛选下没有已确认重复题。</p>')+(pending?`<details><summary>展开 ${candidates.length} 对待核查候选</summary>${pending}</details>`:'');
 $('#pairs').querySelectorAll('[data-open]').forEach(button=>button.onclick=()=>openRelatedQuestion(button.dataset.open));
}
function renderPage(){if(view!=='pages')return;const ps=B.pages.filter(p=>(!$('#paper').value||p.paper==$('#paper').value)&&(!$('#year').value||B.papers.find(x=>x.id===p.paper)?.year==$('#year').value));if(!ps.length)return;let p=B.pages[pageIndex];if(!ps.includes(p)){p=ps[0];pageIndex=B.pages.indexOf(p)}$('#pageSelect').innerHTML=ps.map(p=>`<option value="${B.pages.indexOf(p)}">${names[p.paper]} · 第 ${p.page} 页</option>`).join('');$('#pageSelect').value=pageIndex;$('#fullPage').src=p.image;$('#pagePrev').disabled=ps[0]===p;$('#pageNext').disabled=ps.at(-1)===p;$('#pagePrev').onclick=()=>{pageIndex=B.pages.indexOf(ps[ps.indexOf(p)-1]);renderPage()};$('#pageNext').onclick=()=>{pageIndex=B.pages.indexOf(ps[ps.indexOf(p)+1]);renderPage()}}
$('#pageSelect').onchange=e=>{pageIndex=Number(e.target.value);renderPage()};document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>switchView(b.dataset.view));['#paper','#kind','#status','#dedup'].forEach(s=>$(s).onchange=refresh);$('#search').oninput=refresh;$('#random').onclick=()=>{if(filtered.length)choose(filtered[Math.floor(Math.random()*filtered.length)].id)};
$('#export').onclick=()=>{checkpointTimer();save();const blob=new Blob([JSON.stringify({app:'spic2026-bank',version:1,state},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='国家电投学习记录-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('学习记录已导出')};
$('#import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const obj=JSON.parse(await file.text());if(obj.app!=='spic2026-bank'||obj.version!==1||!obj.state||typeof obj.state!=='object')throw Error();pauseQuestionTimer();questionClock={id:null,startedAt:null};const incoming=obj.state;for(const field of ['records','favorites','keys','edits','notes','timers']){const values=incoming[field];if(!values||typeof values!=='object'||Array.isArray(values))continue;for(const [id,val] of Object.entries(values)){if(!byId[id])continue;if(field==='records'&&(!val||!Array.isArray(val.selected)||!val.selected.every(x=>/^[A-H]$/.test(x))))continue;if(field==='timers'&&(!val||!Number.isFinite(val.elapsedMs)||val.elapsedMs<0||typeof val.finished!=='boolean'))continue;if(field==='keys'&&(typeof val!=='string'||!/^[A-H]*$/.test(val)))continue;if(field==='notes'&&typeof val!=='string')continue;if(field==='favorites'&&typeof val!=='boolean')continue;if(field==='edits'&&(!val||typeof val.stem!=='string'||!Array.isArray(val.options)||!val.options.every(o=>o&&/^[A-H]$/.test(o.key)&&typeof o.text==='string')))continue;state[field][id]=val}}reconcileAnswers();save();refresh();toast('学习记录已合并导入，并按参考答案更新判分')}catch(err){toast('导入失败，请选择本程序导出的学习记录文件')}finally{e.target.value=''}};
$('#footer').textContent=`${B.pages.length} 页原卷 · ${B.questions.filter(q=>q.type!=='复合题材料'&&!q.excluded).length} 个题目条目 + ${B.questions.filter(q=>q.type==='复合题材料'&&!q.excluded).length} 份共用材料 · ${B.answerCount||0} 道已有判分答案（含 ${B.supplementalAnswerCount||0} 道补充解答） · ${B.duplicateSummary?.groups||0} 组已确认重复题（含 ${B.duplicateSummary?.crossFormatGroups||0} 组图片与文字重复）。资料来源：用户提供的 ${B.papers.length} 份 PDF；答案区分原卷标注与补充解答；不同年份资料请结合原卷日期使用。`;
const regraded=reconcileAnswers();if(regraded)save();
$('#year').innerHTML='<option value="">全部年份</option>'+[...new Set(B.papers.map(p=>String(p.year)))].sort().reverse().map(y=>'<option value="'+esc(y)+'">'+esc(y)+(y==='未标年份'?'':' 年')+'</option>').join('');$('.notice').textContent='已有 '+B.answerCount+' 道判分答案，其中 '+(B.supplementalAnswerCount||0)+' 道为补充解答 · 答对一次即掌握。另有7道附文字解答或疑点说明，可点“查看解答 / 核查说明”。';populatePapers();$('#pagesView h2').textContent='完整原卷 · '+B.pages.length+' 页';refresh();if(!storageOK)toast('浏览器存储不可用，请及时导出学习记录。');else if(regraded)toast(`已按参考答案重新判分 ${regraded} 道历史作答，答对即掌握。`);

function populatePapers(){const current=$('#paper').value;$('#paper').innerHTML='<option value="">全部试卷</option>'+B.papers.filter(p=>!$('#year').value||p.year==$('#year').value).map(p=>'<option value="'+p.id+'">'+esc(p.label)+'</option>').join('');if([...$('#paper').options].some(o=>o.value===current))$('#paper').value=current;}
$('#year').onchange=()=>{populatePapers();refresh()};
function renderOptionAnalysis(q){
 if(!q.optionExplanations?.length)return '';
 const normalize=s=>String(s||'').normalize('NFKC').replace(/[\s\p{P}]/gu,'').toLowerCase();
 const rows=q.optionExplanations.map(item=>{
  const matches=q.options.filter(o=>normalize(o.text)===normalize(item.optionText));
  const current=matches.length===1?matches[0]:null;
  const label=current?current.key:'原卷 '+item.key;
  return `<article class="optionAnalysisItem"><p class="optionAnalysisTitle"><strong>${esc(label)}</strong> ${esc(current?.text||item.optionText)}</p>${current?'':'<p class="hint">此选项文字已被修改或无法唯一对应，以下解释保留原卷内容供对照。</p>'}<p>${esc(item.text)}</p></article>`;
 }).join('');
 const references=(q.optionExplanationReferences||[]).filter(r=>/^https:\/\//.test(r.url)).map(r=>`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>`).join(' · ');
 return `<section class="optionAnalysis" aria-label="逐项解析"><h3>逐项解析</h3><p class="hint">${esc(q.optionExplanationSource||'补充逐项解析')}</p>${q.optionExplanationNote?`<p class="reviewReason">${esc(q.optionExplanationNote)}</p>`:''}${rows}${references?`<p class="hint optionAnalysisReferences">核查依据：${references}</p>`:''}</section>`;
}
function enhanceQuestion(q){
 if(q.photoProofread?.pendingReason||q.photoProofread?.sourceIssue){const note=document.createElement('p');note.className='reviewReason';note.textContent=q.photoProofread.pendingReason||q.photoProofread.sourceIssue;$('#card .stem').before(note)}
 if(q.textDisplay){
  if(q.textDisplay.mode==='text+figure'&&!q.practiceImage){
   const visual=document.createElement('div');visual.className='practiceFigure';
   visual.innerHTML=(q.chartImages||q.questionImages||q.images||[q.image]).map((src,i)=>'<a href="'+esc(src)+'" target="_blank" rel="noopener"><img class="practiceimg" src="'+esc(src)+'" alt="本题所需图形或图表'+(i+1)+'"></a>').join('')+'<p class="hint">题干和文字选项见文字区；图形、图表可点击放大。</p>';
   $('#options').before(visual);
  }
  const original=$('#gotoPage').closest('details');original.open=false;
  original.querySelector('summary').textContent='对照题目原图（可能含答案标注）';
 }
 if(q.explanation||q.explanationImages?.length||q.solutionText||q.optionExplanations?.length){
  const explanation=document.createElement('details');explanation.className='answerExplanation';
  explanation.hidden=!submitted;explanation.innerHTML='<summary>查看答案与解析</summary><p class="hint">'+esc(q.answerNote||'按原卷提供的参考答案和解析收录。')+'</p>'+renderOptionAnalysis(q)+(q.optionExplanations?.length&&(q.explanation||q.explanationImages?.length)?'<h3>原有解析 · 对照阅读</h3>':'')+(q.solutionText?'<p><strong>'+esc(q.solutionText)+'</strong></p>':'')+(q.explanationImages?.length?q.explanationImages.map(src=>'<a href="'+esc(src)+'" target="_blank" rel="noopener"><img loading="lazy" class="sourceimg" src="'+esc(src)+'" alt="原卷答案与解析"></a>').join(''):'<div class="stem">'+esc(q.explanation)+'</div>')+(q.answerReferences||[]).filter(r=>/^https:\/\//.test(r.url)||/^documents\/\d+\.pdf(?:#page=\d+)?$/.test(r.url)).map(r=>'<p class="hint">依据：<a href="'+esc(r.url)+'" target="_blank" rel="noopener">'+esc(r.title)+'</a></p>').join('');
  $('#feedback').after(explanation);
  for(const button of [...$('#options').querySelectorAll('button'),$('#restartTimer')])button.addEventListener('click',()=>{explanation.hidden=true;explanation.open=false});
  if(q.solutionText&&!key(q.id)){
   const reveal=document.createElement('button');reveal.textContent='查看解答 / 核查说明';reveal.onclick=()=>{explanation.hidden=false;explanation.open=true;explanation.scrollIntoView({behavior:'smooth',block:'nearest'})};$('#card .actions').prepend(reveal);
  }
 }

 if(q.practiceImage){
  const visual=document.createElement('div');visual.className='practiceFigure';
  visual.innerHTML='<a href="'+esc(q.practiceImage)+'" target="_blank" rel="noopener"><img class="practiceimg" src="'+esc(q.practiceImage)+'" alt="题目图形及图形选项截图"></a><p class="hint">'+esc(q.practiceImageNote||'')+' 点击图片可放大。按钮按原卷选项排列，请以按钮上的“图 A / 图 B”等文字对应图形。</p>';
  $('#options').before(visual);
  const original=$('#gotoPage').closest('details');original.open=false;original.querySelector('summary').textContent='查看原卷与答案标记（展开会显示答案）';
 }

 if(!q.questionImages&&!q.practiceImage&&((q.sourceReview&&!q.textReviewed)||q.visualQuestion)){const src=$('#gotoPage').closest('details');src.open=true;$('#options').before(src);if(q.sourceReview&&!q.textReviewed){const msg=document.createElement('p');msg.className='reviewReason';msg.textContent=q.sourceReviewReason;src.prepend(msg)}}
 const extra=(q.images||[]).slice(1);if(extra.length){const wrap=document.createElement('div');wrap.innerHTML='<p class="hint">以下为本题的后续图形、续文或选项：</p>'+extra.map(src=>'<a href="'+src+'" target="_blank" rel="noopener"><img class="sourceimg" src="'+src+'" alt="跨页题目续图"></a>').join('');$('#gotoPage').before(wrap);if(q.continuationPages?.length)$('#card .source').textContent+=' · 续页 '+q.continuationPages.join('、');}

 if(q.material&&byId[q.material]){const m=getq(q.material);const el=document.createElement('details');el.className='material';const pictures=(m.images||[m.image]).map(src=>'<a href="'+esc(src)+'" target="_blank" rel="noopener"><img class="sourceimg" src="'+esc(src)+'" alt="共用材料原图"></a>').join('');el.innerHTML='<summary>阅读本题共用材料 · '+names[m.paper]+'第 '+m.page+' 页</summary><div class="stem">'+esc(m.stem)+'</div>'+(m.chartImages?.length?m.chartImages.map(src=>'<a href="'+esc(src)+'" target="_blank" rel="noopener"><img class="sourceimg" src="'+esc(src)+'" alt="材料图表清晰重绘版"></a>').join('')+'<details><summary>对照材料原图</summary>'+pictures+'</details>':m.textDisplay?.mode==='text'?'<details><summary>对照材料原图</summary>'+pictures+'</details>':pictures);$('#card .stem').before(el)}
 if(q.type==='复合题材料'){
  $('#options').hidden=true;$('#card .actions').hidden=true;$('#card .keyrow').hidden=true;$('#card .badges').lastElementChild.textContent='阅读材料';
  const related=B.questions.filter(x=>x.material===q.id&&!x.excluded);
  const block=document.createElement('div');block.className='materialNav';
  block.innerHTML=related.length?'<p>本材料关联 '+related.length+' 道小题，点击下面的按钮开始作答。</p><div class="actions">'+related.map(x=>'<button class="primary" data-related="'+x.id+'">开始作答 · '+esc(x.number)+'（第 '+x.page+' 页）</button>').join('')+'</div>':'<p>原卷此处仅含材料，未识别到对应小题；请查看完整原页。</p>';
  $('#card > .stem').before(block);block.querySelectorAll('[data-related]').forEach(b=>b.onclick=()=>openRelatedQuestion(b.dataset.related));
 }
}


function renderReview(){
 if(view!=='review')return;
 const qs=B.questions.map(q=>getq(q.id)).filter(q=>!q.excluded&&(q.sourceReview||q.duplicateProofread?.status==='partial')&&!q.textReviewed&&matches(q));
 $('#reviewCount').textContent=qs.length+' 道原卷仍有疑点';
 $('#reviewItems').innerHTML=qs.map(q=>`<article class="reviewItem" data-review-id="${q.id}"><h3>${esc(q.id)} · ${names[q.paper]} · 第 ${q.page} 页</h3><p class="reviewReason">${esc(q.duplicateProofread?.note||q.sourceReviewReason)}</p><div class="reviewColumns"><div>${(q.images||[q.image]).map(src=>`<a href="${src}" target="_blank" rel="noopener"><img loading="lazy" class="sourceimg" src="${src}" alt="${q.id}原图"></a>`).join('')}<a href="${q.pageImage}" target="_blank">查看完整原页 ↗</a></div><div class="editgrid"><label>题干<textarea class="reviewStem" aria-label="${q.id}题干">${esc(q.stem)}</textarea></label><label>${q.practiceImage?'选项对应关系（例如 A. 图B）':'选项（每行一项，例如 A. 内容）'}<textarea class="reviewOptions" aria-label="${q.id}选项">${esc(q.options.map(o=>o.key+'. '+o.text.replace(/\n/g,' ')).join('\n'))}</textarea></label><p class="hint">确认清楚后可直接修改并保存；仍被原卷遮挡或截断的内容可保留待确认。</p><button class="reviewSave primary">保存这题校正</button><button class="reviewPractice">回到这题练习</button><span class="reviewSaved hint" role="status"></span></div></div></article>`).join('')||'<p class="empty">当前筛选下没有待确认题目。</p>';
 $('#reviewItems').querySelectorAll('.reviewItem').forEach(el=>{
  const id=el.dataset.reviewId;
  el.querySelector('.reviewSave').onclick=()=>{
   const q=getq(id),stem=el.querySelector('.reviewStem').value.trim(),options=[];
   for(const line of el.querySelector('.reviewOptions').value.split('\n').filter(x=>x.trim())){
    const m=line.match(/^\s*([A-H])[.、．\s]+(.+)$/i);
    if(!m||options.some(o=>o.key===m[1].toUpperCase())){toast('请检查选项格式和重复字母');return}
    options.push({key:m[1].toUpperCase(),text:m[2].trim()});
   }
   const complete=stem&&[...(q.type==='判断题'?'AB':'ABCD')].every(k=>options.some(o=>o.key===k&&o.text))&&!options.some(o=>/[\[〔][^\]〕]*(?:遮挡|模糊|未截|未显示|文字不清)[^\]〕]*[\]〕]/.test(o.text));
   state.edits[id]={stem,options,textReviewed:!!complete};save();
   el.querySelector('.reviewSaved').textContent=complete?'已保存，刷新列表后移出待确认。':'已保存已有内容，缺失选项仍保留待确认。';
  };
  el.querySelector('.reviewPractice').onclick=()=>{$('#status').value='';active=id;setView('practice')};
  const alt=getq(id).reviewAlternative;
  if(alt&&byId[alt]&&!byId[alt].excluded){const btn=document.createElement('button');btn.className='reviewAlternative';btn.textContent='练习其他试卷的完整同题 · '+alt;btn.onclick=()=>{for(const name of ['search','year','paper','kind','status'])$('#'+name).value='';active=alt;setView('practice')};el.querySelector('.reviewPractice').before(btn)}
 });
}

function renderDocuments(){
 if(view!=='documents')return;
 const term=$('#search').value.trim().toLowerCase(),docs=(B.documents||[]).filter(d=>(!$('#paper').value||d.paper==$('#paper').value)&&(!$('#year').value||B.papers.find(p=>p.id===d.paper)?.year==$('#year').value)&&(!term||d.title.toLowerCase().includes(term)));
 $('#documentList').innerHTML=docs.map(d=>'<article class="documentCard"><span class="badge">'+esc(d.kind)+'</span><h3>'+esc(d.title)+'</h3><p>'+d.pages+' 页'+(d.questionCount?' · '+d.questionCount+' 道可练习题':'')+'</p><p class="hint">'+esc(d.note)+'</p><div class="actions"><button data-read="'+d.paper+'">阅读原卷</button>'+(d.questionCount?'<button data-practice="'+d.paper+'">练习这套题</button>':'')+'<a href="'+esc(d.path)+'" target="_blank" rel="noopener">打开 PDF ↗</a></div></article>').join('')||'<p class="empty">当前筛选下没有资料，试试清空年份或试卷筛选。</p>';
 $('#documentList').querySelectorAll('[data-read]').forEach(btn=>btn.onclick=()=>{document.getElementById('year').value='';populatePapers();document.getElementById('paper').value=btn.dataset.read;pageIndex=B.pages.findIndex(p=>p.paper==btn.dataset.read);setView('pages')});
 $('#documentList').querySelectorAll('[data-practice]').forEach(btn=>btn.onclick=()=>{['search','year','status','kind'].forEach(id=>document.getElementById(id).value='');populatePapers();document.getElementById('paper').value=btn.dataset.practice;setView('practice')});
}
