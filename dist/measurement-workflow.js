import {Session,prediction} from './validation.js?v=0.8.1';
// Preparation observes eyes only for calibration; it cannot advance research time.
export function observeFrame(session,raw,t,measuring){return measuring?session.update(raw,t):prediction(raw,session.calibration,session.data.config);}
export function prepareCalibration(session,cal,t){session.calibration=cal;session.data.calibration=cal;session.data.evaluationStart=null;session.event('CALIBRATION_READY',t);}
export function beginMeasurementSession(prepared,preparationSeconds){
 if(!prepared?.calibration||prepared.calibration.points?.length!==9)throw Error('먼저 화면의 9개 점을 보며 보정을 완료하세요.');
 const s=new Session(structuredClone(prepared.data.meta),{...prepared.data.config});
 s.data.preparation={durationSeconds:preparationSeconds,completedAt:new Date().toISOString(),events:structuredClone(prepared.data.events),calibrationOnly:true};
 const cal=structuredClone(prepared.calibration);cal.preparedAtSeconds=cal.fittedAt;cal.fittedAt=0;
 s.setCalibration(cal,0);s.event('MEASUREMENT_START',0);return s;
}

export function calibrationViewportMatches(saved,current,tolerance=2){
 return !!saved&&!!current&&['width','height'].every(k=>Number.isFinite(saved[k])&&Number.isFinite(current[k])&&Math.abs(saved[k]-current[k])<=tolerance);
}
export function testAvailability({connected,calibrated,loading,busy,activeTask,viewportMatches=true}){
 if(loading)return {enabled:false,phase:'loading',message:'카메라 또는 측정 기능을 준비하고 있습니다.'};
 if(!connected)return {enabled:false,phase:'disconnected',message:'카메라 연결 · 자동 보정을 먼저 눌러주세요.'};
 if(busy)return {enabled:false,phase:'busy',message:'보정 또는 테스트를 진행 중입니다.'};
 if(!calibrated)return {enabled:false,phase:'uncalibrated',message:'9점 보정이 완료되지 않았습니다. 보정을 다시 시작해주세요.'};
 if(!viewportMatches)return {enabled:false,phase:'resized',message:'화면 크기가 바뀌었습니다. 같은 창에서 9점 보정을 다시 진행해주세요.'};
 if(activeTask)return {enabled:false,phase:'task',message:'진행 중인 문항을 종료하면 주시 테스트를 시작할 수 있습니다.'};
 return {enabled:true,phase:'ready',message:'보정 완료 · 화면 안 또는 화면 밖 주시 테스트를 선택하세요.'};
}
export function prepareNextMeasurementSession(previous,nextId){
 if(!previous?.calibration||previous.calibration.points?.length!==9)throw Error('재사용할 보정이 없습니다.');
 if(!nextId||nextId===previous.data.meta.session)throw Error('다음 측정에는 새 세션 ID가 필요합니다.');
 const s=new Session({...structuredClone(previous.data.meta),session:nextId},{...previous.data.config});
 const cal=structuredClone(previous.calibration);cal.reusedFromSession=previous.data.meta.session;cal.fittedAt=0;
 prepareCalibration(s,cal,0);return s;
}
