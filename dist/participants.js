import {validateRaterARows,validateTimingARows} from './descriptive.js';

export const PROFILE_KEY='gaze-participants-v1';
export const SESSION_KEY='gaze-validation-v2';
export const BACKUP_SCHEMA='gaze-participant-backup-1';
const JOURNAL_KEY='gaze-participants-transaction-v1';
const copy=value=>JSON.parse(JSON.stringify(value));
const blank=value=>value===undefined||value===null||String(value).trim()==='';
const enums={gender:['female','male','other','unknown'],visionBasis:['corrected','uncorrected','unknown'],correction:['none','glasses','contacts','other','unknown']};
function text(value,label,max=200){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error(`${label}을(를) ${max}자 이내로 입력해 주세요.`);return value.trim();}
function number(value,label,max,integer=false){if(blank(value))return null;if(typeof value!=='number'&&typeof value!=='string')throw Error(`${label}은(는) 숫자여야 합니다.`);const n=Number(value);if(!Number.isFinite(n)||n<0||n>max||(integer&&!Number.isInteger(n)))throw Error(`${label}은(는) 0~${max}${integer?'의 정수':''}로 입력해 주세요.`);return n;}
function date(value,label){if(blank(value))return '';if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error(`${label} 날짜를 확인해 주세요.`);return value;}
function object(value,label){if(!value||typeof value!=='object'||Array.isArray(value))throw Error(`${label} 형식이 올바르지 않습니다.`);}
export function validateProfile(input){
 object(input,'대상자 정보');
 const output={id:text(input.id,'대상자 ID',80),name:text(input.name,'이름',100),age:number(input.age,'연령',120,true),ageAsOfDate:date(input.ageAsOfDate,'기본정보 기록 기준일'),visionRight:number(input.visionRight,'오른쪽 시력',3),visionLeft:number(input.visionLeft,'왼쪽 시력',3)};
 for(const [key,allowed]of Object.entries(enums)){const value=blank(input[key])?'unknown':input[key];if(!allowed.includes(value))throw Error(`${key} 선택값을 확인해 주세요.`);output[key]=value;}
 if(!blank(input.notes)&&typeof input.notes!=='string')throw Error('메모 형식이 올바르지 않습니다.');
 output.notes=String(input.notes??'').trim();if(output.notes.length>5000)throw Error('메모는 5,000자 이내로 입력해 주세요.');
 for(const key of ['createdAt','updatedAt'])if(input[key]!==undefined){if(typeof input[key]!=='string'||!Number.isFinite(Date.parse(input[key])))throw Error('기본정보 저장 날짜를 확인해 주세요.');output[key]=input[key];}
 return output;
}
function validateSession(input){
 object(input,'세션');const session=copy(input);
 if(!['gaze-validation-2','gaze-A-descriptive-3'].includes(session.schema))throw Error('지원하지 않는 세션 형식입니다.');
 object(session.meta,'세션 기본정보');text(session.meta.session,'세션 ID',120);text(session.meta.participant,'세션 대상자 ID',80);
 if(!['camera','demo','reference'].includes(session.meta.mode))throw Error('세션 측정 종류를 확인해 주세요.');
 if(!['development','validation'].includes(session.meta.role))throw Error('세션 용도를 확인해 주세요.');
 if(session.meta.correctionAtSession!==undefined&&!enums.correction.includes(session.meta.correctionAtSession))throw Error('세션 당시 시력 교정 상태를 확인해 주세요.');
 if(typeof session.duration!=='number'||!Number.isFinite(session.duration)||session.duration<0||session.duration>86400)throw Error('세션 길이를 확인해 주세요.');
 if(typeof session.startedAt!=='string'||!Number.isFinite(Date.parse(session.startedAt)))throw Error('세션 날짜를 확인해 주세요.');
 object(session.config,'세션 설정');if(session.config.bin!==.5||(!session.referenceOnly&&(typeof session.config.hold!=='number'||session.config.hold<=0||!Number.isFinite(session.config.hold))))throw Error('세션 구간 설정을 확인해 주세요.');
 if(session.referenceOnly){object(session.referenceGrid,'관찰 범위');if(![session.referenceGrid.start,session.referenceGrid.end].every(v=>typeof v==='number'&&Number.isFinite(v))||session.referenceGrid.start<0||session.referenceGrid.end<session.referenceGrid.start||session.referenceGrid.end>session.duration)throw Error('관찰 범위를 확인해 주세요.');}
 else if(session.evaluationStart!==null&&(typeof session.evaluationStart!=='number'||!Number.isFinite(session.evaluationStart)||session.evaluationStart<0||session.evaluationStart>session.duration+.5))throw Error('측정 시작 시간을 확인해 주세요.');
 for(const key of ['samples','events','trials','timings'])if(!Array.isArray(session[key]))throw Error(`세션 ${key} 자료가 배열이 아닙니다.`);
 for(const sample of session.samples){object(sample,'측정 표본');if(typeof sample.t!=='number'||!Number.isFinite(sample.t)||sample.t<0||sample.t>session.duration+.001)throw Error('측정 표본 시간을 확인해 주세요.');for(const field of ['direction','screen','head'])if(typeof sample[field]!=='string')throw Error('측정 표본 분류를 확인해 주세요.');}
 for(const event of session.timings){if(!['GAZE','RESPONSE','DELAY'].includes(event.kind)||![event.start,event.end].every(v=>typeof v==='number'&&Number.isFinite(v))||event.start<0||event.end<event.start||event.end>session.duration+.001)throw Error('프로그램 시간 자료를 확인해 주세요.');}
 if(session.tasks!==undefined){if(!Array.isArray(session.tasks))throw Error('문항 기록은 배열이어야 합니다.');const ids=new Set(),items=new Set();for(const t of session.tasks){object(t,'문항');if(typeof t.id!=='string'||!t.id||ids.has(t.id)||typeof t.itemId!=='string'||!t.itemId||items.has(t.itemId)||typeof t.itemLabel!=='string'||!t.itemLabel)throw Error('문항 ID·이름 또는 중복을 확인하세요.');ids.add(t.id);items.add(t.itemId);if(!Number.isFinite(t.start)||t.start<0||t.start>session.duration||!Number.isFinite(t.end)||t.end<t.start||t.end>session.duration||!['complete','interrupted'].includes(t.status))throw Error('문항 시작·종료와 상태를 확인하세요.');if(t.response!==null&&(!Number.isFinite(t.response)||t.response<t.start||t.response>t.end))throw Error('문항 응답 시각을 확인하세요.');}}
 object(session.references,'관찰자료');for(const key of ['a','b','consensus','timing','timingA'])if(session.references[key]!==undefined&&!Array.isArray(session.references[key]))throw Error('관찰자료 형식을 확인해 주세요.');
 validateRaterARows(session.references.a??[],session);validateTimingARows(session.references.timingA??[],session);
 if(session.meta.participantSnapshot){const snapshot=validateProfile(session.meta.participantSnapshot);if(snapshot.id!==session.meta.participant)throw Error('세션의 대상자 기본정보 사본과 ID가 다릅니다.');}
 return session;
}
function unique(items,key,label){const seen=new Set();for(const item of items){const id=key(item);if(seen.has(id))throw Error(`${label} ID가 중복되었습니다: ${id}`);seen.add(id);}return items;}
function validatePayload(payload){
 if(typeof payload==='string'){try{payload=JSON.parse(payload);}catch{throw Error('백업 JSON 파일을 읽을 수 없습니다.');}}
 object(payload,'백업');if(payload.schema!==BACKUP_SCHEMA)throw Error('대상자 전체 백업 파일을 선택해 주세요.');
 if(!Array.isArray(payload.profiles)||!Array.isArray(payload.sessions))throw Error('백업의 대상자·세션 목록을 확인해 주세요.');
 return {profiles:unique(payload.profiles.map(validateProfile),p=>p.id,'대상자'),sessions:unique(payload.sessions.map(validateSession),s=>s.meta.session,'세션')};
}
export function createRepository(storage=globalThis.localStorage){
 if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw Error('브라우저 저장소를 사용할 수 없습니다.');
 // A journal restores both old keys after interruption; never discard corrupt data.
 const journal=storage.getItem(JOURNAL_KEY);
 if(journal!==null){let old;try{old=JSON.parse(journal);}catch{throw Error('이전 저장 작업 복구가 필요합니다. 원본 브라우저 자료를 유지하세요.');}if(!old||![PROFILE_KEY,SESSION_KEY].every(key=>Object.hasOwn(old,key)&&(old[key]===null||typeof old[key]==='string')))throw Error('저장 복구 정보가 손상되었습니다.');for(const key of [PROFILE_KEY,SESSION_KEY])old[key]===null?storage.removeItem(key):storage.setItem(key,old[key]);storage.removeItem(JOURNAL_KEY);}
 function read(key){const raw=storage.getItem(key);if(raw===null)return [];let data;try{data=JSON.parse(raw);}catch{throw Error('저장된 자료가 손상되었습니다. 원본을 보존하고 백업을 확인해 주세요.');}if(!Array.isArray(data))throw Error('저장된 자료 목록의 형식이 올바르지 않습니다.');return data;}
 function profiles(){return unique(read(PROFILE_KEY).map(validateProfile),p=>p.id,'대상자');}
 function sessions(){const rows=read(SESSION_KEY);for(const s of rows){object(s,'저장 세션');object(s.meta,'저장 세션 기본정보');text(s.meta.session,'세션 ID',120);text(s.meta.participant,'대상자 ID',80);}return unique(rows,s=>s.meta.session,'세션');}
 function commit(nextProfiles,nextSessions){
  const before=Object.fromEntries([PROFILE_KEY,SESSION_KEY].map(key=>[key,storage.getItem(key)]));
  storage.setItem(JOURNAL_KEY,JSON.stringify(before));
  try{storage.setItem(PROFILE_KEY,JSON.stringify(nextProfiles));storage.setItem(SESSION_KEY,JSON.stringify(nextSessions));storage.removeItem(JOURNAL_KEY);}
  catch(error){try{for(const key of [PROFILE_KEY,SESSION_KEY])before[key]===null?storage.removeItem(key):storage.setItem(key,before[key]);storage.removeItem(JOURNAL_KEY);}catch{throw Error('저장 실패 후 복구가 보류되었습니다. 페이지를 다시 열어 복구하세요. 원본 자료는 복구 정보에 남아 있습니다.');}throw Error('저장 공간이 부족하거나 저장할 수 없습니다. 변경 내용은 반영되지 않았습니다.');}
 }
 return {
  listProfiles:()=>copy(profiles()),sessions:()=>copy(sessions()),
  saveProfile(input,{replace=false}={}){const profile=validateProfile(input),rows=profiles(),index=rows.findIndex(p=>p.id===profile.id),now=new Date().toISOString();if(index>=0&&!replace)throw Error('같은 대상자 ID가 이미 있습니다. 수정 기능을 사용해 주세요.');profile.createdAt=index>=0?rows[index].createdAt??now:now;profile.updatedAt=now;if(index>=0)rows[index]=profile;else rows.push(profile);commit(rows,sessions());return copy(profile);},
  profileSnapshot(id){const profile=profiles().find(p=>p.id===id);return profile?copy(profile):null;},
  subjectSummary(id){const all=sessions().filter(s=>s.meta.participant===id),timeline=all.map(s=>({session:s.meta.session,startedAt:s.startedAt??null,duration:Number.isFinite(s.duration)?s.duration:0,mode:s.meta.mode,role:s.meta.role,hasRaterA:(s.references?.a??[]).some(r=>['direction','screen','head'].some(f=>r[f]&&r[f]!=='UNCLEAR')),hasProgram:(s.samples??[]).length>0,snapshot:s.meta.participantSnapshot?copy(s.meta.participantSnapshot):null})).sort((a,b)=>(b.startedAt??'').localeCompare(a.startedAt??''));return {id,sessionCount:all.length,cameraCount:all.filter(s=>s.meta.mode==='camera').length,demoCount:all.filter(s=>s.meta.mode==='demo').length,referenceCount:all.filter(s=>s.meta.mode==='reference').length,totalDuration:timeline.reduce((n,s)=>n+s.duration,0),firstDate:timeline.at(-1)?.startedAt??null,lastDate:timeline[0]?.startedAt??null,timeline};},
  backup(){return {schema:BACKUP_SCHEMA,exportedAt:new Date().toISOString(),profiles:copy(profiles()),sessions:copy(sessions())};},
  importBackup(payload,{strategy='reject'}={}){
   if(!['reject','keepExisting','replace'].includes(strategy))throw Error('백업 병합 방식을 확인해 주세요.');
   const incoming=validatePayload(payload),oldProfiles=profiles(),oldSessions=sessions(),pc=new Set(oldProfiles.map(p=>p.id)),sc=new Set(oldSessions.map(s=>s.meta.session)),profileConflicts=incoming.profiles.filter(p=>pc.has(p.id)).map(p=>p.id),sessionConflicts=incoming.sessions.filter(s=>sc.has(s.meta.session)).map(s=>s.meta.session);
   const profilesById=new Map(oldProfiles.map(p=>[p.id,p])),sessionsById=new Map(oldSessions.map(s=>[s.meta.session,s]));
   for(const s of incoming.sessions){const old=sessionsById.get(s.meta.session);if(old&&old.meta.participant!==s.meta.participant)throw Error(`같은 세션 ID에 다른 대상자가 지정되어 있습니다: ${s.meta.session}. 원본 ID를 확인해 주세요.`);}
   if(strategy==='keepExisting')for(const p of incoming.profiles){const old=profilesById.get(p.id);if(old&&old.name!==p.name)throw Error(`같은 대상자 ID에 다른 이름이 있습니다: ${p.id}. 다른 대상자의 기록이 섞이지 않도록 원본 ID를 확인해 주세요.`);}
   if(strategy==='reject'&&(profileConflicts.length||sessionConflicts.length))throw Error(`중복 자료가 있습니다. 대상자 ${profileConflicts.length}명, 세션 ${sessionConflicts.length}개. 새 자료만 추가하려면 현재 자료 유지 방식을 선택해 주세요.`);
   const merge=(old,next,key)=>{const map=new Map(old.map(item=>[key(item),item]));for(const item of next)if(strategy==='replace'||!map.has(key(item)))map.set(key(item),item);return [...map.values()];};
   commit(merge(oldProfiles,incoming.profiles,p=>p.id),merge(oldSessions,incoming.sessions,s=>s.meta.session));return {profiles:incoming.profiles.length,sessions:incoming.sessions.length,profileConflicts,sessionConflicts,strategy};
  }
 };
}
