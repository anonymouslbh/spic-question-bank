(function(root){
'use strict';
const KEY='spic-mock-exams-2027-v1';
const norm=v=>[...new Set(Array.isArray(v)?v:String(v||'').split(''))].sort().join('');
function create(exam,now,id){return {id,examId:exam.id,title:exam.title,startedAt:now,deadline:now+exam.durationSeconds*1000,status:'running',answers:{},index:0,questions:JSON.parse(JSON.stringify(exam.questions))};}
function grade(a){let earned=0,total=0,correct=0,answered=0;const rows=a.questions.map(q=>{const selection=norm(a.answers[q.id]);if(selection)answered++;const valid=q.gradable&&!!q.answer;const right=valid&&(q.acceptedAnswers||[q.answer]).some(s=>norm(s)===selection);if(valid)total+=Math.round(q.points*10);if(right){earned+=Math.round(q.points*10);correct++;}return {id:q.id,selection,status:!valid?'ungraded':!selection?'blank':right?'correct':'wrong',points:right?q.points:0};});return {earned:earned/10,total:total/10,percent:total?Math.round(earned/total*1000)/10:0,correct,answered,gradedCount:rows.filter(r=>r.status!=='ungraded').length,rows};}
function finish(a,now,reason){if(a.status!=='running')return false;a.status='submitted';a.finishedAt=Math.min(now,a.deadline);a.reason=now>=a.deadline?'timeout':reason||'manual';a.result=grade(a);return true;}
function choose(a,qid,key,now){if(a.status!=='running')return false;if(now>=a.deadline){finish(a,now,'timeout');return false;}const q=a.questions.find(q=>q.id===qid);if(!q||!q.options.some(o=>o.key===key))return false;const old=norm(a.answers[qid]);a.answers[qid]=q.type==='多选题'?norm(old.includes(key)?old.replace(key,''):old+key):(old===key?'':key);return true;}
root.MockCore={KEY,norm,create,grade,finish,choose};
})(typeof window==='undefined'?globalThis:window);
