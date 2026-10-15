const SESSION='gaze-validation-v2',JOURNAL='gaze-participants-transaction-v1',FORMAT='gaze-local-columns-1';
// Column storage removes repeated field names; values and observation times are unchanged.
export function encodeSessions(text){const sessions=JSON.parse(text);if(!Array.isArray(sessions))throw Error('세션 자료 형식을 확인하세요.');return JSON.stringify({schema:FORMAT,sessions:sessions.map(s=>{if(!Array.isArray(s.samples)||s.samples.some(x=>!x||typeof x!=='object'||Array.isArray(x)))return {plain:s};const {samples,...record}=s,columns=[...new Set(samples.flatMap(x=>Object.keys(x)))],missing={},rows=samples.map((x,i)=>{const absent=[];const row=columns.map((k,j)=>{if(!Object.hasOwn(x,k)){absent.push(j);return null;}return x[k];});if(absent.length)missing[i]=absent;return row;});return {record,columns,rows,missing};})});}
export function decodeSessions(text){const value=JSON.parse(text);if(value?.schema!==FORMAT)return text;if(!Array.isArray(value.sessions))throw Error('저장된 세션 자료를 복구할 수 없습니다.');return JSON.stringify(value.sessions.map(s=>{if(Object.hasOwn(s,'plain'))return s.plain;if(!Array.isArray(s.columns)||!Array.isArray(s.rows))throw Error('저장된 관측 자료가 손상되었습니다.');return {...s.record,samples:s.rows.map((row,i)=>{if(!Array.isArray(row)||row.length!==s.columns.length)throw Error('저장된 관측 열 수가 다릅니다.');const missing=new Set(s.missing?.[i]??[]);return Object.fromEntries(s.columns.flatMap((k,j)=>missing.has(j)?[]:[[k,row[j]]]));})};}));}
export function createCompactStorage(native){const cache=new Map();const store={
 getItem(key){const raw=native.getItem(key);if(raw===null)return null;const previous=cache.get(key);if(previous?.raw===raw)return previous.decoded;let decoded=raw;
 if(key===SESSION)decoded=decodeSessions(raw);
 if(key===JOURNAL){const value=JSON.parse(raw);if(value?.schema==='gaze-local-journal-1'){const before=value.before;if(typeof before?.[SESSION]==='string')before[SESSION]=decodeSessions(before[SESSION]);decoded=JSON.stringify(before);}}
 cache.set(key,{raw,decoded});return decoded;},
 setItem(key,text){let raw=text;if(key===SESSION)raw=encodeSessions(text);if(key===JOURNAL){const before=JSON.parse(text);if(typeof before?.[SESSION]==='string')before[SESSION]=encodeSessions(before[SESSION]);raw=JSON.stringify({schema:'gaze-local-journal-1',before});}native.setItem(key,raw);cache.set(key,{raw,decoded:text});},
 removeItem(key){native.removeItem(key);cache.delete(key);}
 };
 // Atomic setItem preserves the original value if migration fails. Leave pending recovery alone.
 if(native.getItem(JOURNAL)===null){const raw=native.getItem(SESSION);if(raw!==null){try{const decoded=decodeSessions(raw),packed=encodeSessions(decoded);if(packed.length<raw.length)native.setItem(SESSION,packed);}catch{ /* Repository checks original data and provides recovery on corruption. */ }}}
 return store;
}
