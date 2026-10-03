import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTelemetryIntent} from '../launch/live-intent.js';

test('exact depth phrase',()=>assert.deepEqual(parseTelemetryIntent('set the depth to 40%').telemetry,{depth:.4}));
test('reverse depth phrase',()=>assert.deepEqual(parseTelemetryIntent('40% depth').telemetry,{depth:.4}));
test('speed without percent sign',()=>assert.deepEqual(parseTelemetryIntent('set speed to 55').telemetry,{pace:.55}));
test('force phrase',()=>assert.deepEqual(parseTelemetryIntent('force 30 percent').telemetry,{force:.3}));
test('energy phrase',()=>assert.deepEqual(parseTelemetryIntent('energy to 70%').telemetry,{intensity:.7}));
test('multiple telemetry values',()=>{
  const r=parseTelemetryIntent('set speed 60, depth 45%, force 35 and energy 50 percent');
  assert.deepEqual(r.telemetry,{depth:.45,pace:.6,force:.35,intensity:.5});
});
test('clamps telemetry to 100',()=>assert.deepEqual(parseTelemetryIntent('depth 140%').telemetry,{depth:1}));
test('saved pattern requires an available saved pattern',()=>{
  assert.equal(parseTelemetryIntent('use saved pattern',{hasCustomPattern:false}).pattern,null);
  assert.equal(parseTelemetryIntent('use saved pattern',{hasCustomPattern:true}).pattern,'custom');
});
test('named pattern',()=>assert.equal(parseTelemetryIntent('switch to wave pattern').pattern,'wave'));
test('position command',()=>assert.equal(parseTelemetryIntent('change position to standing').position,'standing'));
test('ordinary mention does not force position',()=>assert.equal(parseTelemetryIntent('I was standing earlier').position,null));
