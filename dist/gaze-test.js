import {intervals} from './validation.js';
export const TARGET_RULE={radius:.12,dwell:.5};
// Normalized viewport coordinates. Never clamp an offscreen estimate onto the screen.
export function markerPosition(sample,now,hold=.15){
 if(!sample||!Number.isFinite(sample.t)||now-sample.t>hold||now<sample.t||sample.screen==='UNKNOWN'||!Number.isFinite(sample.x)||!Number.isFinite(sample.y))return {visible:false,status:'lost'};
 if(sample.x<0||sample.x>1||sample.y<0||sample.y>1)return {visible:false,status:'outside'};
 return {visible:true,status:'inside',x:sample.x,y:sample.y};
}
export function targetEvidence(data,trial){
 const point=trial.instruction?.point,rule=trial.targetRule??TARGET_RULE,end=trial.end??data.duration;
 if(!point)return {targetX:null,targetY:null,validSeconds:null,nearSeconds:null,longestNearSeconds:null,estimatedHit:null,radius:null,dwell:null};
 let validSeconds=0,nearSeconds=0,longest=0,run=0,previousEnd=null;
 for(const s of intervals(data)){const a=Math.max(s.start,trial.start),b=Math.min(s.end,end);if(b<=a)continue;
 const valid=s.screen!=='UNKNOWN'&&Number.isFinite(s.x)&&Number.isFinite(s.y),near=valid&&Math.hypot(s.x-point[0],s.y-point[1])<=rule.radius;
 if(valid)validSeconds+=b-a;
 if(near){nearSeconds+=b-a;run=(previousEnd!==null&&Math.abs(previousEnd-a)<1e-7?run:0)+b-a;longest=Math.max(longest,run);}else run=0;previousEnd=b;
 }
 return {targetX:point[0],targetY:point[1],validSeconds,nearSeconds,longestNearSeconds:longest,estimatedHit:trial.end==null||trial.interrupted?null:longest+1e-8>=rule.dwell,radius:rule.radius,dwell:rule.dwell};
}
export function targetCounts(data){const trials=(data.trials??[]).filter(t=>t.kind==='target');return {collected:data.calibration?.points?.length??(data.events??[]).filter(e=>e.type==='POINT_CAPTURED').length,planned:(data.events??[]).filter(e=>e.type==='TRIAL_RUN_START'&&e.kind==='target').reduce((n,e)=>n+e.planned,0)||trials.length,presented:trials.length,completed:trials.filter(t=>t.end!=null&&!t.interrupted).length,estimatedHits:trials.filter(t=>targetEvidence(data,t).estimatedHit===true).length};}
