// Collect open-eye calibration samples without cancelling a point for a blink.
export function calibrationStep(capture,raw,t,{duration=1.3,settle=.35,minFrames=10}={}){
 if(raw&&raw.pose&&[raw.ear,raw.irisX,raw.irisY,raw.pose.yaw,raw.pose.pitch,raw.pose.roll].every(Number.isFinite)&&raw.ear>0&&t-capture.start>=settle)capture.samples.push(raw);
 if(t-capture.start<duration)return {status:'collecting'};
 const ordered=capture.samples.map(s=>s.ear).sort((a,b)=>a-b);
 if(!ordered.length)return {status:'retry',reason:'얼굴과 눈을 확인할 수 없습니다. 카메라를 정면으로 보고 다시 수집하세요.'};
 // The upper half represents the participant's more open eye posture.
 const openEar=ordered[Math.floor((ordered.length-1)*.75)];
 const valid=capture.samples.filter(s=>s.ear>=openEar*.75);
 if(valid.length<minFrames)return {status:'retry',reason:'유효 관측이 부족합니다. 눈을 뜨고 같은 표적을 다시 바라봐 주세요.'};
 return {status:'complete',samples:valid,openEar};
}
export function calibrationSpace(fullscreen,width,height){return {coordinateSpace:fullscreen?'fullscreen viewport':'browser viewport',viewport:{width,height,fullscreen:!!fullscreen}};}

export const AUTO_CALIBRATION={duration:1.8,maxDuration:4,settle:.65,minFrames:12,irisSD:.025,headSD:2.5};
export function automaticCalibrationStep(capture,raw,t){
 const r=calibrationStep(capture,raw,t,AUTO_CALIBRATION);if(r.status==='retry'&&t-capture.start<AUTO_CALIBRATION.maxDuration)return {status:'collecting'};if(r.status!=='complete')return r;
 const sd=values=>{const mean=values.reduce((a,b)=>a+b,0)/values.length;return Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length);};
 if(['irisX','irisY'].some(k=>sd(r.samples.map(s=>s[k]))>AUTO_CALIBRATION.irisSD)||['yaw','pitch','roll'].some(k=>sd(r.samples.map(s=>s.pose[k]))>AUTO_CALIBRATION.headSD))return {status:'retry',reason:'눈과 머리 움직임이 큽니다. 머리를 고정하고 같은 점을 바라보세요.'};
 return r;
}
