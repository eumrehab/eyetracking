import {bins, parseCSV, DIRECTIONS, HEADS} from './validation.js';

const FIELDS={direction:DIRECTIONS,screen:['INSIDE','OUTSIDE'],head:HEADS};
const KINDS=['GAZE','RESPONSE','DELAY'];
const blank=v=>v===undefined||v===null||String(v).trim()==='';
const pct=(n,d)=>d?100*n/d:null;
const finite=v=>!blank(v)&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(String(v).trim())&&Number.isFinite(Number(v));
export function referenceBins(data){
 if(!data.referenceGrid)return bins(data);
 const {start,end}=data.referenceGrid;
 if(!finite(start)||!finite(end)||Number(start)<0||Number(end)<Number(start)||data.config.bin!==.5)throw Error('독립 기준자료 범위와 0.5초 구간 설정을 확인해 주세요.');
 const rows=[];
 for(let t=Number(start);t+.5<=Number(end)+1e-8;t+=.5)rows.push({start:Number(t.toFixed(6)),end:Number((t+.5).toFixed(6))});
 return rows;
}
function referenceTimes(r){
 const basis=blank(r.time_basis)?'session':r.time_basis;
 if(!['session','video'].includes(basis))throw Error('시간 기준은 session 또는 video여야 합니다.');
 if(!blank(r.video_offset_s)&&!finite(r.video_offset_s))throw Error('영상 오프셋은 유한한 숫자여야 합니다.');
 if(basis==='video'&&!finite(r.video_offset_s))throw Error('영상 시간 기준에는 video_offset_s가 필요합니다.');
 const offset=basis==='video'?Number(r.video_offset_s):0;
 return {start:Number(r.start_s)+offset,end:Number(r.end_s)+offset};
}
export function descriptiveStats(values){
 const v=values.filter(Number.isFinite).sort((a,b)=>a-b),n=v.length;
 if(!n)return {n:0,mean:null,median:null,sd:null,min:null,max:null};
 const mean=v.reduce((a,b)=>a+b,0)/n;
 return {n,mean,median:n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2,sd:n>1?Math.sqrt(v.reduce((s,x)=>s+(x-mean)**2,0)/(n-1)):null,min:v[0],max:v[n-1]};
}
function checkRows(rows,required,data){
 let rater=null;
 for(const r of rows){
  for(const key of required)if(!Object.hasOwn(r,key))throw Error(`필수 CSV 열이 없습니다: ${key}`);
  if(r.session_id!==data.meta.session)throw Error('세션 ID가 일치하지 않습니다.');
  if(!blank(r.participant_id)&&r.participant_id!==data.meta.participant)throw Error('대상자 ID가 선택한 대상자와 일치하지 않습니다.');
  if(Object.hasOwn(r,'rater_id')){
   if(blank(r.rater_id))throw Error('평가자 ID가 비어 있습니다.');
   if(rater!==null&&rater!==r.rater_id)throw Error('평가자 A 파일에는 한 평가자의 자료만 넣어 주세요.');
   rater=r.rater_id;
  }
 }
 return rows;
}
function parseRequired(text,required){
 // parseCSV normally removes the header. A synthetic record reveals its exact names,
 // including duplicate/quoted header validation, even for an empty template.
 const first=text.match(/^(?:[^"\r\n]|"(?:[^"]|"")*")*/)?.[0]??'';
 const headerCells=parseCSV(first+'\n'+first).at(0);
 for(const key of required)if(!headerCells||!Object.hasOwn(headerCells,key))throw Error(`필수 CSV 열이 없습니다: ${key}`);
 return parseCSV(text);
}
export function validateRaterACSV(text,data){return validateRaterARows(parseRequired(text,['session_id','bin_start_s','bin_end_s','direction','screen','head']),data);}
export function validateTimingACSV(text,data){return validateTimingARows(parseRequired(text,['session_id','id','kind','start_s','end_s']),data);}
export function validateRaterARows(rows,data){
 checkRows(rows,['session_id','bin_start_s','bin_end_s','direction','screen','head'],data);
 const known=new Map(referenceBins(data).map(b=>[b.start.toFixed(7),b.end])),seen=new Set();
 for(const r of rows){
  if(!finite(r.bin_start_s)||!finite(r.bin_end_s))throw Error('구간 시작·종료는 유한한 숫자여야 합니다.');
  const start=Number(r.bin_start_s),end=Number(r.bin_end_s);
  if(!known.has(start.toFixed(7))||Math.abs(known.get(start.toFixed(7))-end)>=1e-7)throw Error('구간 시작·종료가 세션의 0.5초 구간과 일치하지 않습니다.');
  if(seen.has(start))throw Error('중복 평가 구간입니다.');seen.add(start);
  for(const [f,allowed]of Object.entries(FIELDS))if(!blank(r[f])&&!allowed.includes(r[f])&&r[f]!=='UNCLEAR')throw Error(`${f} 값이 올바르지 않습니다: ${r[f]}`);
 }
 return rows;
}
export function validateTimingARows(rows,data){
 checkRows(rows,['session_id','id','kind','start_s','end_s'],data);const seen=new Set();
 for(const r of rows){
  if(blank(r.id)||seen.has(r.id))throw Error('시간 사건 ID가 비어 있거나 중복되었습니다.');seen.add(r.id);
  if(!KINDS.includes(r.kind))throw Error('시간 사건 종류가 올바르지 않습니다.');
  const adjusted=referenceTimes(r);
  if(blank(r.start_s)&&blank(r.end_s))continue;
  if(!finite(r.start_s)||!finite(r.end_s))throw Error('시간 시작·종료를 모두 숫자로 입력하거나 모두 비워 주세요.');
  if(Number(r.start_s)<0||Number(r.end_s)<Number(r.start_s)||adjusted.start<0||adjusted.end>data.duration+1e-7)throw Error('시간 사건 범위가 세션 범위를 벗어납니다.');
 }
 return rows;
}
function summarizeTiming(rows,reference){
 return KINDS.map(kind=>{
  const raw=rows.filter(r=>r.kind===kind),complete=[],missingRows=[],invalidRows=[];
  for(const r of raw){
   const a=reference?r.start_s:r.start,b=reference?r.end_s:r.end;
   if(blank(a)&&blank(b)){missingRows.push(r);continue;}
   if(!finite(a)||!finite(b)||Number(a)<0||Number(b)<Number(a)){invalidRows.push(r);continue;}
   let adjusted={start:Number(a),end:Number(b)};
   if(reference){try{adjusted=referenceTimes(r);}catch{invalidRows.push(r);continue;}}
   complete.push({id:r.id,kind,start_s:adjusted.start,end_s:adjusted.end,duration_s:adjusted.end-adjusted.start});
  }
  return {kind,...descriptiveStats(complete.map(r=>r.duration_s)),missing:missingRows.length,invalid:invalidRows.length,rows:complete};
 });
}
function episodeSummary(rows){
 const values={INSIDE:[],OUTSIDE:[]};let active=null;
 const finish=()=>{if(active)values[active.category].push(active.end-active.start);active=null;};
 for(const r of rows){
  if(!Object.hasOwn(values,r.screen)){finish();continue;}
  if(active&&active.category===r.screen&&Math.abs(active.end-r.start)<1e-7)active.end=r.end;
  else{finish();active={category:r.screen,start:r.start,end:r.end};}
 }finish();
 return {quantizationSeconds:.5,INSIDE:{...descriptiveStats(values.INSIDE),durationsSeconds:values.INSIDE},OUTSIDE:{...descriptiveStats(values.OUTSIDE),durationsSeconds:values.OUTSIDE}};
}
function summarizeRows(rows,source,binSeconds,timing){
 const totalBins=rows.length,totalSeconds=rows.reduce((s,r)=>s+r.end-r.start,0);
 const fields=Object.entries(FIELDS).map(([field,categories])=>{
  const valid=rows.filter(r=>categories.includes(r[field])).length,unclear=rows.filter(r=>r[field]==='UNCLEAR').length;
  const missing=rows.filter(r=>blank(r[field])).length,failed=rows.filter(r=>r[field]==='UNKNOWN').length;
  const out={field,total:totalBins,completed:valid+unclear,missing,unclear,valid,coveragePct:pct(valid+unclear,totalBins),categories:categories.map(category=>{const selected=rows.filter(r=>r[field]===category);return {category,n:selected.length,seconds:selected.reduce((s,r)=>s+r.end-r.start,0),totalPct:pct(selected.length,totalBins),validPct:pct(selected.length,valid)};})};
  if(source==='program')Object.assign(out,{completed:valid,failed,failurePct:pct(failed,totalBins),weightedFailurePct:pct(rows.reduce((s,r)=>s+(Number.isFinite(r[field+'Failure'])?r[field+'Failure']:r[field]==='UNKNOWN'?1:0),0),totalBins)});
  return out;
 });
 return {source,totalBins,totalSeconds,binSeconds,fields,episodes:episodeSummary(rows),timing};
}
export function summarizeRaterA(data){
 const refs=new Map((data.references?.a??[]).map(r=>[Number(r.bin_start_s),r]));
 const rows=referenceBins(data).map(b=>{const r=refs.get(b.start);return {start:b.start,end:b.end,...Object.fromEntries(Object.keys(FIELDS).map(f=>[f,r?.[f]??'']))};});
 return summarizeRows(rows,'raterA',data.config.bin,summarizeTiming(data.references?.timingA??[],true));
}
export function summarizeProgram(data){return summarizeRows(data.referenceOnly?[]:bins(data),'program',data.config.bin,summarizeTiming(data.referenceOnly?[]:data.timings??[],false));}
function mergeSummaries(items,source){
 const totalBins=items.reduce((s,x)=>s+x.totalBins,0),totalSeconds=items.reduce((s,x)=>s+x.totalSeconds,0);
 const fields=Object.keys(FIELDS).map(field=>{
  const all=items.map(x=>x.fields.find(f=>f.field===field)),sum=k=>all.reduce((s,x)=>s+(x[k]??0),0),valid=sum('valid'),completed=sum('completed');
  const out={field,total:totalBins,completed,valid,missing:sum('missing'),unclear:sum('unclear'),coveragePct:pct(completed,totalBins),categories:FIELDS[field].map(category=>{const c=all.map(x=>x.categories.find(c=>c.category===category));const n=c.reduce((s,x)=>s+x.n,0);return {category,n,seconds:c.reduce((s,x)=>s+x.seconds,0),totalPct:pct(n,totalBins),validPct:pct(n,valid)};})};
  if(source==='program')Object.assign(out,{failed:sum('failed'),failurePct:pct(sum('failed'),totalBins),weightedFailurePct:totalBins?all.reduce((s,x)=>s+(x.weightedFailurePct??0)*x.total,0)/totalBins:null});
  return out;
 });
 const timing=KINDS.map(kind=>{const a=items.map(x=>x.timing.find(t=>t.kind===kind)),rows=a.flatMap(x=>x.rows);return {kind,...descriptiveStats(rows.map(x=>x.duration_s)),missing:a.reduce((s,x)=>s+x.missing,0),invalid:a.reduce((s,x)=>s+x.invalid,0),rows};});
 const episodes={quantizationSeconds:.5,...Object.fromEntries(['INSIDE','OUTSIDE'].map(category=>{const durationsSeconds=items.flatMap(x=>x.episodes[category].durationsSeconds);return [category,{...descriptiveStats(durationsSeconds),durationsSeconds}];}))};
 return {source,totalBins,totalSeconds,fields,timing,episodes};
}
function participantStats(people,source){
 return {fields:Object.keys(FIELDS).map(field=>{const values=people.map(p=>p[source].fields.find(f=>f.field===field));return {field,coveragePct:descriptiveStats(values.map(v=>v.coveragePct)),failurePct:descriptiveStats(values.map(v=>v.failurePct)),weightedFailurePct:descriptiveStats(values.map(v=>v.weightedFailurePct)),categories:FIELDS[field].map(category=>({category,totalPct:descriptiveStats(values.map(v=>v.categories.find(c=>c.category===category).totalPct)),validPct:descriptiveStats(values.map(v=>v.categories.find(c=>c.category===category).validPct))}))};}),timing:KINDS.map(kind=>({kind,participantMeanSeconds:descriptiveStats(people.map(p=>p[source].timing.find(t=>t.kind===kind).mean))})),episodes:Object.fromEntries(['INSIDE','OUTSIDE'].map(category=>[category,{participantMeanSeconds:descriptiveStats(people.map(p=>p[source].episodes[category].mean))}]))};
}
export function cohortDescriptive(sessions){
 const groups=new Map();sessions.forEach((s,index)=>{const mode=s.meta.mode??'unspecified',role=s.meta.role??'unspecified',key=JSON.stringify([mode,role]);if(!groups.has(key))groups.set(key,{mode,role,sessions:[]});groups.get(key).sessions.push({data:s,index});});
 return {sessionCount:sessions.length,groups:[...groups.values()].map(g=>{const people=new Map();for(const {data:s,index}of g.sessions){const participant=blank(s.meta.participant)?`미입력 세션 ${index+1}`:s.meta.participant;if(!people.has(participant))people.set(participant,[]);people.get(participant).push(s);}const participants=[...people].map(([participant,all])=>({participant,sessionCount:all.length,sessionIds:all.map(s=>s.meta.session),raterA:mergeSummaries(all.map(summarizeRaterA),'raterA'),program:mergeSummaries(all.map(summarizeProgram),'program')}));return {mode:g.mode,role:g.role,sessionCount:g.sessions.length,participants,participantStats:{raterA:participantStats(participants,'raterA'),program:participantStats(participants,'program')}};})};
}
