import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGameFeatures, STAR_XI_PLAYERS, getStarXISelectionRating, setBestStarXI, getStarXIPositions, getBestStarXISelection, normalizeStarXIState } from '../app/feature-data.ts';
import { emptyPlayerStats } from '../app/career-data.ts';
test('form uses existing bounded bonus and missing data stays neutral', () => {
 const f=initialGameFeatures(), p=STAR_XI_PLAYERS[0];
 assert.equal(getStarXISelectionRating(p,{career:f.career}),p.rating);
 f.career.players[p.id]={...emptyPlayerStats(),recent:[9,9,9]};
 assert.equal(getStarXISelectionRating(p,{career:f.career}),Math.min(100,p.rating+2));
 f.career.players[p.id].recent=[4.5];
 assert.equal(getStarXISelectionRating(p,{career:f.career}),p.rating-2);
});
test('live context ignores old matches and prepared bonuses do not stack',()=>{
 const f=initialGameFeatures(),p=STAR_XI_PLAYERS[0];
 f.career.players[p.id]={...emptyPlayerStats(),recent:[9]};
 Object.assign(f.cup,{active:true,matchStartedAt:1234,careerRatingSeed:1234,careerBonuses:{[p.id]:2},playerEnteredAt:{}});
 assert.equal(getStarXISelectionRating(p,{career:f.career,cup:f.cup}),Math.min(100,p.rating+2));
 f.cup.playerEnteredAt[p.id]=1;
 const live=getStarXISelectionRating(p,{career:f.career,cup:f.cup,minute:75});
 assert.ok(Number.isFinite(live));
 f.cup.active=false;
 assert.equal(getStarXISelectionRating(p,{career:f.career,cup:f.cup,minute:75}),Math.min(100,p.rating+2));
});
test('whole collection produces valid stable saved assignments and safe match lock',()=>{
 const f=initialGameFeatures();f.starXI.ownedIds=STAR_XI_PLAYERS.map(p=>p.id);
 const next=setBestStarXI(f.starXI,[],{career:f.career,cup:f.cup});
 assert.equal(next.lineupIds.filter(Boolean).length,11);
 next.lineupIds.forEach((id,i)=>assert.ok(getStarXIPositions(STAR_XI_PLAYERS.find(p=>p.id===id)!).includes(next.formationPositions[i])));
 const all=[...next.lineupIds,...next.benchIds].filter(Boolean);
 assert.equal(new Set(all).size,all.length);
 assert.ok(next.benchIds.filter(id=>{const p=STAR_XI_PLAYERS.find(p=>p.id===id);return p&&getStarXIPositions(p).every(pos=>pos==='TW');}).length<=1);
 assert.deepEqual(setBestStarXI(next,[],{career:f.career}).lineupIds,next.lineupIds);
 assert.deepEqual(normalizeStarXIState(JSON.parse(JSON.stringify(next))).lineupIds,next.lineupIds);
 f.cup.active=true;assert.equal(setBestStarXI(next,[],{cup:f.cup}),next);
 f.cup.active=false;
 const blocked=next.lineupIds[0];assert.ok(!setBestStarXI(next,[blocked],{career:f.career}).lineupIds.includes(blocked));
});

test('form changes a close contested slot and secondary positions score equally',()=>{
 const f=initialGameFeatures();
 const pair=STAR_XI_PLAYERS.flatMap(a=>STAR_XI_PLAYERS.filter(b=>b.id!==a.id&&a.rating>b.rating&&a.rating-b.rating<=3&&getStarXIPositions(b).includes(a.position!)).map(b=>[a,b])).find(([a,b])=>a.rating<98&&b.rating<98)!;
 const [a,b]=pair;
 f.career.players[a.id]={...emptyPlayerStats(),recent:[4.5]};
 f.career.players[b.id]={...emptyPlayerStats(),recent:[9]};
 const positions=Array(11).fill(a.position);
 const basic=getBestStarXISelection([a.id,b.id],positions);
 const formed=getBestStarXISelection([a.id,b.id],positions,[],{career:f.career});
 assert.ok(getStarXISelectionRating(b,{career:f.career})>getStarXISelectionRating(a,{career:f.career}));
 // One slot plus ten goalkeeper slots leaves the contestants competing directly.
 const slots=[a.position,...Array(10).fill('TW')];
 if(a.position!=='TW'&&!getStarXIPositions(a).includes('TW')&&!getStarXIPositions(b).includes('TW')) {
 assert.equal(getBestStarXISelection([a.id,b.id],slots)[0],a.id);
 assert.equal(getBestStarXISelection([a.id,b.id],slots,[],{career:f.career})[0],b.id);
 }
 assert.equal(basic.filter(Boolean).length,formed.filter(Boolean).length);
 const multi=STAR_XI_PLAYERS.find(p=>getStarXIPositions(p).length>=3&& !getStarXIPositions(p).includes('TW'))!;
 for(const pos of getStarXIPositions(multi)) assert.equal(getBestStarXISelection([multi.id],[pos,...Array(10).fill('TW')])[0],multi.id);
});
