import assert from 'node:assert/strict';import {LaneTracker,defaultLines,laneCenters,smoothPoint} from './public/tracking.js';
const lines=defaultLines();assert.deepEqual(laneCenters(lines,.95),lines.near);assert.deepEqual(laneCenters(lines,.55),lines.far);
let t=new LaneTracker();assert.equal(t.update(.15,.95,lines,0),0);assert.equal(t.update(.15,.95,lines,100),-1);assert.equal(t.update(.15,.95,lines,300),-1);t.update(.85,.95,lines,400);assert.equal(t.update(.85,.95,lines,500),1);t.update(.5,.95,lines,600);assert.equal(t.update(.5,.95,lines,700),0);
for(let i=0;i<20;i++)assert.equal(t.update(.325+(i%2?.01:-.01),.95,lines,800+i*100),0);
let p=smoothPoint({x:.5,y:.5},{x:.51,y:.49,visibility:1},.033);assert.ok(p.x>.5&&p.x<.51);assert.equal(smoothPoint({x:.5,y:.5},{x:0,y:0,visibility:.1},.03).x,.5);console.log('PASS: perspective, absolute lanes, sustained position, direct lane changes, boundary stability, smoothing and occlusion.');
