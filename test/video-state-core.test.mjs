import test from 'node:test';
import assert from 'node:assert/strict';
import {VIDEO_STATES,VIDEO_STATE_IDS,stateById,extractStateId,metadataWarnings,orderedAssignments} from '../launch/video-state-core.js';

test('catalog contains contiguous A00-A20 states',()=>{
  assert.equal(VIDEO_STATES.length,22);
  assert.deepEqual(VIDEO_STATE_IDS.slice(0,21),Array.from({length:21},(_,i)=>'A'+String(i).padStart(2,'0'))); assert.equal(VIDEO_STATE_IDS[21],'A18B');
});
test('state lookup is case insensitive',()=>assert.equal(stateById('a05')?.name,'THINK ANALYTICAL'));
test('filename extracts state IDs without false A99 matches',()=>{
  assert.equal(extractStateId('anna_A03_listen.mp4'),'A03');
  assert.equal(extractStateId('redo-a20-final.mov'),'A20');
  assert.equal(extractStateId('A18B_peak_alt.mp4'),'A18B');
  assert.equal(extractStateId('anna_A99.mp4'),null);
});
test('ordered stack respects filename IDs then fills open slots',()=>{
  const files=[{name:'clip.mp4'},{name:'A03_listen.mp4'},{name:'clip2.mp4'}];
  const out=orderedAssignments(files,['A00']);
  assert.equal(out.assigned.find(x=>x.file.name==='A03_listen.mp4').id,'A03');
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
