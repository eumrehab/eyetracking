import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRaterA,summarizeProgram,cohortDescriptive,validateRaterACSV,validateTimingACSV,validateRaterARows,descriptiveStats,referenceBins} from './dist/descriptive.js';
function fixture(screens=['INSIDE','OUTSIDE','','UNCLEAR']){
 return {meta:{session:'S1',participant:'P1',mode:'camera',role:'validation'},duration:screens.length*.5,evaluationStart:0,config:{bin:.5,hold:.15},samples:[],timings:[],references:{a:screens.map((screen,i)=>({session_id:'S1',bin_start_s:String(i*.5),bin_end_s:String((i+1)*.5),direction:screen==='INSIDE'?'CENTER':'',screen,head:'CENTER'})),timingA:[],b:[],consensus:[],timing:[]}};
}
const screen=s=>s.fields.find(f=>f.field==='screen');
test('A descriptive denominators separate missing and unclear, and never use B, consensus or AI',()=>{
 const d=fixture(),before=summarizeRaterA(d),s=screen(before);
 assert.equal(s.total,4);assert.equal(s.valid,2);assert.equal(s.missing,1);assert.equal(s.unclear,1);assert.equal(s.completed,3);
 assert.deepEqual(s.categories[0],{category:'INSIDE',n:1,seconds:.5,totalPct:25,validPct:50});
 d.references.b=d.references.a.map(r=>({...r,screen:'OUTSIDE'}));d.references.consensus=d.references.b;d.references.timing=[{kind:'GAZE',start_s:'0',end_s:'2'}];d.samples=[{t:0,screen:'OUTSIDE',direction:'LEFT',head:'LEFT'}];
 assert.deepEqual(summarizeRaterA(d),before);
});
test('zero denominators are absent, not observed zero; sample SD requires two values',()=>{
 const empty=summarizeRaterA(fixture([]));assert.equal(screen(empty).coveragePct,null);assert.equal(screen(empty).categories[0].totalPct,null);
 const noValid=screen(summarizeRaterA(fixture(['','UNCLEAR'])));assert.equal(noValid.categories[0].validPct,null);assert.equal(noValid.categories[0].totalPct,0);
 assert.deepEqual(descriptiveStats([]),{n:0,mean:null,median:null,sd:null,min:null,max:null});assert.equal(descriptiveStats([1]).sd,null);assert.equal(descriptiveStats([1,3]).sd,Math.sqrt(2));
});
test('missing, unclear, and temporal gaps break quantized screen episodes',()=>{
 const d=fixture(['INSIDE','INSIDE','','INSIDE','UNCLEAR','INSIDE','OUTSIDE','OUTSIDE']);const e=summarizeRaterA(d).episodes;
 assert.equal(e.quantizationSeconds,.5);assert.equal(e.INSIDE.n,3);assert.equal(e.INSIDE.mean,2/3);assert.equal(e.INSIDE.median,.5);assert.equal(e.INSIDE.max,1);assert.equal(e.OUTSIDE.n,1);assert.equal(e.OUTSIDE.mean,1);
});
test('A timing is independent, with blank pairs and no program matching or error',()=>{
 const d=fixture();d.references.timingA=[{id:'human1',kind:'GAZE',start_s:'0',end_s:'1'},{id:'human2',kind:'GAZE',start_s:'1',end_s:'1.5'},{id:'human3',kind:'GAZE',start_s:'',end_s:''}];d.timings=[{id:'human1',kind:'GAZE',start:0,end:1.9,duration:1.9}];
 const t=summarizeRaterA(d).timing[0];assert.equal(t.n,2);assert.equal(t.mean,.75);assert.equal(t.missing,1);assert.equal(t.invalid,0);assert.ok(!Object.hasOwn(t,'mae'));assert.equal(summarizeProgram(d).timing[0].mean,1.9);
});
test('strict A CSV headers, matching interval endpoints, session and single evaluator',()=>{
 const d=fixture();const h='session_id,bin_start_s,bin_end_s,direction,screen,head';const row='S1,0,0.5,CENTER,INSIDE,CENTER';
 assert.equal(validateRaterACSV(h+'\n'+row,d).length,1);assert.equal(validateRaterACSV(h,d).length,0);
 assert.throws(()=>validateRaterACSV('session_id,bin_start_s,direction,screen,head\nS1,0,CENTER,INSIDE,CENTER',d));
 assert.throws(()=>validateRaterACSV(h+'\nS1,0,0.6,CENTER,INSIDE,CENTER',d));assert.throws(()=>validateRaterACSV(h+'\nS1,0x0,0.5,CENTER,INSIDE,CENTER',d));assert.throws(()=>validateRaterACSV(h+'\n'+row+'\n'+row,d));assert.throws(()=>validateRaterACSV(h+'\nS2,0,0.5,CENTER,INSIDE,CENTER',d));
 assert.throws(()=>validateRaterACSV(h+',rater_id\n'+row+',A\nS1,0.5,1,CENTER,INSIDE,CENTER,B',d));
 assert.throws(()=>validateRaterARows([{...d.references.a[0],screen:'UNKNOWN'}],d));
});
test('strict A timing CSV accepts independent IDs and blank pair; rejects partial, infinity, reversed, duplicate and unknown types',()=>{
 const d=fixture(),h='session_id,id,kind,start_s,end_s';
 assert.equal(validateTimingACSV(h+'\nS1,human,GAZE,0,1\nS1,missing,DELAY,,',d).length,2);
 for(const row of ['S1,x,GAZE,,1','S1,x,GAZE,0,Infinity','S1,x,GAZE,1,0','S1,x,GAZE,0,3','S1,x,OTHER,0,1','S1,,GAZE,0,1'])assert.throws(()=>validateTimingACSV(h+'\n'+row,d));
 assert.throws(()=>validateTimingACSV(h+'\nS1,x,GAZE,0,1\nS1,x,DELAY,0,1',d));
});
test('A imports reject a different participant even when the session ID matches, while legacy blank participant remains valid',()=>{
 const d=fixture(),h='session_id,bin_start_s,bin_end_s,direction,screen,head,participant_id',row='S1,0,0.5,CENTER,INSIDE,CENTER,';
 assert.equal(validateRaterACSV(h+'\n'+row+'P1',d).length,1);assert.equal(validateRaterACSV(h+'\n'+row,d).length,1);
 assert.throws(()=>validateRaterACSV(h+'\n'+row+'P2',d),/대상자 ID/);
 const timing='session_id,id,kind,start_s,end_s,participant_id\nS1,event1,GAZE,0,1,';
 assert.equal(validateTimingACSV(timing+'P1',d).length,1);assert.throws(()=>validateTimingACSV(timing+'P2',d),/대상자 ID/);
});
test('all sessions included, mode and role separated, participant rates pooled before equal-person mean',()=>{
 const a=fixture(['INSIDE']),b=fixture(['OUTSIDE','OUTSIDE','OUTSIDE']),c=fixture(['INSIDE']);b.meta.session='S2';c.meta.participant='P2';c.meta.session='S3';
 const demo=structuredClone(a);demo.meta.mode='demo';const develop=structuredClone(a);develop.meta.role='development';
 const cohort=cohortDescriptive([a,b,c,demo,develop]);assert.equal(cohort.sessionCount,5);assert.equal(cohort.groups.length,3);
 const g=cohort.groups.find(g=>g.mode==='camera'&&g.role==='validation');assert.equal(g.sessionCount,3);assert.equal(g.participants.length,2);assert.equal(g.participants[0].sessionCount,2);assert.deepEqual(g.participants[0].sessionIds,['S1','S2']);assert.equal(screen(g.participants[0].raterA).categories[0].totalPct,25);
 const stat=g.participantStats.raterA.fields.find(f=>f.field==='screen').categories[0].totalPct;assert.equal(stat.mean,62.5);assert.equal(stat.n,2);
});
test('program UNKNOWN failure has explicit denominator and no accuracy decisions',()=>{
 const d=fixture(['INSIDE','INSIDE']);const p=summarizeProgram(d);assert.equal(screen(p).failed,2);assert.equal(screen(p).failurePct,100);assert.equal(screen(p).weightedFailurePct,100);assert.equal(screen(p).categories[0].validPct,null);assert.ok(!JSON.stringify(p).includes('accuracy'));
});
test('independent A grid works without AI measurements and keeps program summary empty',()=>{
 const d=fixture();d.referenceOnly=true;d.referenceGrid={start:3,end:4.2};d.evaluationStart=null;d.duration=5;d.references.a=[{session_id:'S1',bin_start_s:'3',bin_end_s:'3.5',direction:'CENTER',screen:'INSIDE',head:'CENTER'}];
 assert.deepEqual(referenceBins(d),[{start:3,end:3.5},{start:3.5,end:4}]);assert.equal(validateRaterARows(d.references.a,d).length,1);assert.equal(summarizeRaterA(d).totalBins,2);assert.equal(screen(summarizeRaterA(d)).missing,1);assert.equal(summarizeProgram(d).totalBins,0);
 d.config.bin=1;assert.throws(()=>referenceBins(d));
});
test('video timing offsets validate and produce aligned session time without comparing AI',()=>{
 const d=fixture();d.duration=10;const h='session_id,id,kind,start_s,end_s,time_basis,video_offset_s';
 const rows=validateTimingACSV(h+'\nS1,v,GAZE,1,2,video,3',d);d.references.timingA=rows;const r=summarizeRaterA(d).timing[0].rows[0];assert.equal(r.start_s,4);assert.equal(r.end_s,5);assert.equal(r.duration_s,1);
 for(const row of ['S1,v,GAZE,1,2,video,','S1,v,GAZE,1,2,video,Infinity','S1,v,GAZE,1,2,video,-2','S1,v,GAZE,1,2,video,9','S1,v,GAZE,1,2,bad,0','S1,v,GAZE,1,2,session,NaN'])assert.throws(()=>validateTimingACSV(h+'\n'+row,d));
});
