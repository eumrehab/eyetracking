import test from 'node:test';
import assert from 'node:assert/strict';
import {calibrationStep,calibrationSpace} from './dist/calibration.js';
const raw=ear=>({ear,irisX:.5,irisY:.5,pose:{yaw:0,pitch:0,roll:0}});
test('a blink or a lost face does not cancel a point with enough valid observations',()=>{const c={start:0,samples:[]};let result;for(let i=1;i<=40;i++)result=calibrationStep(c,i>=15&&i<=20?raw(.06):i===24?null:raw(.28),i/30);assert.equal(result.status,'complete');assert.ok(result.samples.every(s=>s.ear===.28));assert.ok(result.samples.length>=10);});
test('naturally lower open-eye EAR can calibrate without a fixed .20 cutoff',()=>{const c={start:0,samples:[]};let r;for(let i=1;i<=40;i++)r=calibrationStep(c,raw(.16),i/30);assert.equal(r.status,'complete');assert.equal(r.openEar,.16);});
test('missing face and too few finite samples yield a retry rather than a false calibration',()=>{const c={start:0,samples:[]};assert.equal(calibrationStep(c,null,1.4).status,'retry');assert.equal(calibrationStep({start:0,samples:[]},{...raw(.3),irisX:NaN},1.4).status,'retry');});
test('window calibration records browser viewport instead of pretending to use physical fullscreen',()=>{assert.deepEqual(calibrationSpace(false,807,790),{coordinateSpace:'browser viewport',viewport:{width:807,height:790,fullscreen:false}});assert.equal(calibrationSpace(true,1920,1080).coordinateSpace,'fullscreen viewport');});
