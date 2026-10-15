import {Session,prediction} from './validation.js';
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
