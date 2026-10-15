import {targetEvidence,targetCounts} from './gaze-test.js';
import {intervals,bins,DIRECTIONS,HEADS,direction} from './validation.js';
import {descriptiveStats} from './descriptive.js';
const pct=(n,d)=>d>0?100*n/d:null;
export function stateEpisodes(data,field='screen',range=null){
 const out=[];let current=null;
 for(const span of intervals(data)){
  const start=Math.max(span.start,range?.start??0),end=Math.min(span.end,range?.end??data.duration);
  if(end<=start)continue;const state=span[field]??'UNKNOWN';
  if(current&&current.state===state&&Math.abs(current.end-start)<1e-7){current.end=end;current.duration=end-current.start;}
  else{current={id:field.toUpperCase()+'_'+(out.length+1),field,state,start,end,duration:end-start};out.push(current);}
 }
 if(field==='screen'){const count={INSIDE:0,OUTSIDE:0,UNKNOWN:0};for(const e of out){count[e.state]=(count[e.state]??0)+1;e.id=({INSIDE:'G',OUTSIDE:'O',UNKNOWN:'F'}[e.state]??'S')+count[e.state];}}return out;
}
function scopeSummary(data,range=null){
 const episodes=stateEpisodes(data,'screen',range),sums={INSIDE:0,OUTSIDE:0,UNKNOWN:0};
 for(const e of episodes)sums[e.state]=(sums[e.state]??0)+e.duration;
 const observedSeconds=sums.INSIDE+sums.OUTSIDE+sums.UNKNOWN,inside=episodes.filter(e=>e.state==='INSIDE'),outside=episodes.filter(e=>e.state==='OUTSIDE');
 return {observedSeconds,insideSeconds:sums.INSIDE,outsideSeconds:sums.OUTSIDE,failedSeconds:sums.UNKNOWN,failurePct:pct(sums.UNKNOWN,observedSeconds),outsideCount:outside.length,insideEpisodes:inside,outsideEpisodes:outside,insideStats:descriptiveStats(inside.map(e=>e.duration)),outsideStats:descriptiveStats(outside.map(e=>e.duration))};
}
export function taskRecords(data){
 const all=data.tasks?.length?data.tasks:(data.events??[]).filter(e=>e.type==='TASK_START').map(e=>{const end=(data.events??[]).find(x=>x.taskId===e.taskId&&['TASK_END','TASK_INTERRUPTED'].includes(x.type));return {id:e.taskId,start:e.t,end:end?.t??null,status:end?.type==='TASK_INTERRUPTED'?'interrupted':end?'complete':'active',itemId:e.itemId??e.taskId,itemLabel:e.itemLabel??'이전 모의 문항'};});
 return all.map(task=>{
 const times=(data.timings??[]).filter(e=>e.taskId===task.id||(!e.taskId&&e.id?.startsWith(task.id+'_')));
 const response=times.find(e=>e.kind==='RESPONSE'),delays=times.filter(e=>e.kind==='DELAY'),end=task.end??data.duration;
 return {...task,itemId:task.itemId??task.id,itemLabel:task.itemLabel??'모의 문항',duration:end-task.start,responseStart:response?.start??null,responseEnd:response?.end??null,responseSeconds:response?.duration??null,responseMissing:!response,delayCount:delays.length,delaySeconds:delays.reduce((s,e)=>s+e.duration,0),delayIntervals:delays,delayAutoClosed:delays.some(e=>e.autoClosed),...scopeSummary(data,{start:task.start,end})};
 });
}
export function researchSummary(data){
 const status=data.referenceOnly?'reference_only':data.evaluationStart===null||data.evaluationStart===undefined?'uncalibrated':data.duration<=data.evaluationStart?'waiting':'measured';
 const distribution=bins(data).map(b=>b);
 const fields=Object.entries({direction:DIRECTIONS,screen:['INSIDE','OUTSIDE'],head:HEADS}).map(([field,states])=>{const valid=distribution.filter(b=>b[field]!=='UNKNOWN').length;return {field,total:distribution.length,valid,failed:distribution.length-valid,categories:states.map(state=>{const n=distribution.filter(b=>b[field]===state).length;return {state,n,seconds:n*data.config.bin,validPct:pct(n,valid),totalPct:pct(n,distribution.length)};})};});
 return {status,...scopeSummary(data),fields,tasks:taskRecords(data),headEpisodes:stateEpisodes(data,'head'),directionEpisodes:stateEpisodes(data,'direction')};
}
export function comparisonRows(data){
 const refs=new Map((data.references?.a??[]).map(r=>[Number(r.bin_start_s),r])),tasks=taskRecords(data);
 return bins(data).map(b=>{const a=refs.get(b.start),overlap=tasks.filter(t=>t.start<b.end&&(t.end??data.duration)>b.start),offset=data.video?.startedAtSessionSeconds;
 return {...b,aDirection:a?.direction??'',aScreen:a?.screen??'',aHead:a?.head??'',aRater:a?.rater_id??'',taskIds:overlap.map(t=>t.id).join('|'),itemIds:overlap.map(t=>t.itemId).join('|'),videoStart:Number.isFinite(offset)&&b.start>=offset?b.start-offset:null,videoEnd:Number.isFinite(offset)&&b.start>=offset?b.end-offset:null};});
}
export function trialRecords(data){return (data.trials??[]).map(t=>({...t,end:t.end??data.duration,expected:t.instruction?.screen??t.instruction?.code??(t.instruction?.point?direction(...t.instruction.point,data.config):''),duration:(t.end??data.duration)-t.start,...scopeSummary(data,{start:t.start,end:t.end??data.duration}),...targetEvidence(data,t)}));}
const meta=(d)=>{const p=d.meta.participantSnapshot??{};return [d.meta.participant,d.meta.session,d.version,d.meta.mode,d.meta.role,d.calibration?.coordinateSpace??'',p.name??'',p.gender??'',p.age??'',p.visionRight??'',p.visionLeft??'',p.visionBasis??'',d.meta.correctionAtSession??p.correction??'',d.meta.protocol??'legacy'];};
function researchRows(data,type){
 const common=['participant_id','session_id','version','mode','role','coordinate_space','name_at_record','gender_at_record','age_at_record','vision_right_at_record','vision_left_at_record','vision_basis','correction_at_record','protocol'];
 if(type==='points'){const heads=[...common,'t_s','trial_id','item_id','gaze_x_normalized','gaze_y_normalized','viewport_width_px','viewport_height_px','direction','screen','head','yaw_deg','pitch_deg','roll_deg','target_x','target_y','distance_to_target_normalized'];const trials=new Map((data.trials??[]).map(t=>[t.id,t]));return [heads,...(data.samples??[]).filter(s=>s.phase==='validation').map(s=>{const point=trials.get(s.trialId)?.instruction?.point,valid=Number.isFinite(s.x)&&Number.isFinite(s.y)&&s.screen!=='UNKNOWN';return [...meta(data),s.t,s.trialId??'',s.itemId??'',s.x,s.y,data.meta.viewport?.width??'',data.meta.viewport?.height??'',s.direction,s.screen,s.head,s.pose?.yaw??null,s.pose?.pitch??null,s.pose?.roll??null,point?.[0]??null,point?.[1]??null,point&&valid?Math.hypot(s.x-point[0],s.y-point[1]):null];})];}
 if(type==='episodes'){const heads=[...common,'episode_id','state','start_s','end_s','duration_s'];return [heads,...stateEpisodes(data).map(e=>[...meta(data),e.id,e.state,e.start,e.end,e.duration])];}
 if(type==='tasks'){const heads=[...common,'task_id','item_id','item_label','status','start_s','end_s','task_duration_s','response_start_s','response_end_s','reaction_time_s','response_missing','delay_count','delay_total_s','delay_auto_closed','observed_s','inside_s','outside_count','outside_s','failure_s'];return [heads,...taskRecords(data).map(t=>[...meta(data),t.id,t.itemId,t.itemLabel,t.status,t.start,t.end,t.duration,t.responseStart,t.responseEnd,t.responseSeconds,t.responseMissing,t.delayCount,t.delaySeconds,t.delayAutoClosed,t.observedSeconds,t.insideSeconds,t.outsideCount,t.outsideSeconds,t.failedSeconds])];}
 if(type==='paired'){const heads=[...common,'bin_start_s','bin_end_s','video_start_s','video_end_s','program_direction','A_direction','program_screen','A_screen','program_head','A_head','A_rater_id','direction_failure_fraction','screen_failure_fraction','head_failure_fraction','task_ids','item_ids'];return [heads,...comparisonRows(data).map(r=>[...meta(data),r.start,r.end,r.videoStart,r.videoEnd,r.direction,r.aDirection,r.screen,r.aScreen,r.head,r.aHead,r.aRater,r.directionFailure,r.screenFailure,r.headFailure,r.taskIds,r.itemIds])];}
 if(type==='events'){const heads=[...common,'event_id','kind','task_id','item_id','raw_start_s','raw_end_s','duration_s','source','time_basis','video_offset_s','session_start_s','session_end_s','auto_closed','close_reason'];return [heads,...(data.timings??[]).map(t=>[...meta(data),t.id,t.kind,t.taskId??'',t.itemId??'',t.start,t.end,t.duration,'program','session',0,t.start,t.end,t.autoClosed??false,t.closeReason??'']),...(data.references?.timingA??[]).map(t=>{const complete=t.start_s!==''&&t.end_s!=='',offset=t.time_basis==='video'?Number(t.video_offset_s):0;return [...meta(data),t.id,t.kind,t.task_id??'',t.item_id??'',t.start_s,t.end_s,complete?Number(t.end_s)-Number(t.start_s):'','rater_A',t.time_basis??'session',t.video_offset_s??'',complete?Number(t.start_s)+offset:'',complete?Number(t.end_s)+offset:'',false,''];})];}
 if(type==='trials'){const heads=[...common,'trial_id','trial_type','instruction','start_s','end_s','duration_s','interrupted','observed_s','inside_s','outside_s','failure_s','target_x','target_y','valid_gaze_s','near_target_s','longest_near_target_s','estimated_hit','radius_normalized','required_dwell_s','run_id'];return [heads,...trialRecords(data).map(t=>[...meta(data),t.id,t.kind,t.expected,t.start,t.end,t.duration,!!t.interrupted,t.observedSeconds,t.insideSeconds,t.outsideSeconds,t.failedSeconds,t.targetX,t.targetY,t.validSeconds,t.nearSeconds,t.longestNearSeconds,t.estimatedHit,t.radius,t.dwell,t.runId??''])];}
 if(type==='summary'){const s=researchSummary(data);if(s.status!=='measured'){for(const k of ['observedSeconds','insideSeconds','outsideCount','outsideSeconds','failedSeconds','failurePct'])s[k]=null;s.insideStats.n=null;}return [[...common,'measurement_status','observed_s','inside_s','outside_count','outside_s','failure_s','failure_pct','gaze_episode_n','gaze_mean_s','gaze_median_s','gaze_max_s','outside_mean_s','task_count','calibration_collected','target_planned','target_presented','target_completed','target_estimated_hits'],[...meta(data),s.status,s.observedSeconds,s.insideSeconds,s.outsideCount,s.outsideSeconds,s.failedSeconds,s.failurePct,s.insideStats.n,s.insideStats.mean,s.insideStats.median,s.insideStats.max,s.outsideStats.mean,s.tasks.length,...(()=>{const c=targetCounts(data);return [c.collected,c.planned,c.presented,c.completed,c.estimatedHits];})()]];}
 throw Error('알 수 없는 연구 자료 종류입니다.');
}

export function researchCSV(data,type){return researchRows(data,type).map(row=>row.map(v=>typeof v==='number'&&Number.isFinite(v)?Math.round(v*1e6)/1e6:v));}
