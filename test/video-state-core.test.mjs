import test from 'node:test';
import assert from 'node:assert/strict';
import {VIDEO_STATES,VIDEO_STATE_IDS,PRIMARY_VIDEO_STATE_IDS,ALTERNATE_VIDEO_STATE_IDS,stateById,extractStateId,metadataWarnings,orderedAssignments} from '../launch/video-state-core.js';

test('catalog contains A00-A20 plus nine alternates',()=>{
  assert.equal(VIDEO_STATES.length,30);
  assert.deepEqual(PRIMARY_VIDEO_STATE_IDS,Array.from({length:21},(_,i)=>'A'+String(i).padStart(2,'0')));
  assert.deepEqual(ALTERNATE_VIDEO_STATE_IDS,['A16B','A17B','A18B','A18C','A18D','A18E','A18F','A19B','A19C']);
});
test('state lookup is case insensitive',()=>assert.equal(stateById('a05')?.name,'THINK ANALYTICAL'));
test('filename extracts primary and alternate IDs without false A99 matches',()=>{
  assert.equal(extractStateId('anna_A03_listen.mp4'),'A03');
  assert.equal(extractStateId('redo-a20-final.mov'),'A20');
  assert.equal(extractStateId('A18C_peak.mp4'),'A18C');
  assert.equal(extractStateId('A18E_peak_open.mp4'),'A18E');
  assert.equal(extractStateId('A19B_recovery.mp4'),'A19B');
  assert.equal(extractStateId('A18F_peak_max.mp4'),'A18F');
  assert.equal(extractStateId('A19C_recovery_neutral.mp4'),'A19C');
  assert.equal(extractStateId('anna_A99.mp4'),null);
});
test('ordered stack respects filename IDs then fills primary open slots',()=>{
  const files=[{name:'clip.mp4'},{name:'A18D_peak.mp4'},{name:'clip2.mp4'}];
  const out=orderedAssignments(files,['A00']);
  assert.equal(out.assigned.find(x=>x.file.name==='A18D_peak.mp4').id,'A18D');
  assert.equal(out.assigned.find(x=>x.file.name==='clip.mp4').id,'A01');
  assert.equal(out.assigned.find(x=>x.file.name==='clip2.mp4').id,'A02');
});
test('metadata flags low resolution and wrong duration',()=>{
  const warnings=metadataWarnings({duration:12,width:512,height:856},stateById('A01'));
  assert.ok(warnings.some(x=>x.includes('Duration')));
  assert.ok(warnings.some(x=>x.includes('Resolution')));
});
test('good vertical metadata has no quality warnings',()=>{
  assert.deepEqual(metadataWarnings({duration:8,width:1080,height:1920},stateById('A01')),[]);
});
