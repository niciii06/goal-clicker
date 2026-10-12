import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { SCRAP_PLAYERS, STAR_FORMATIONS, STAR_PACKS, STAR_XI_PLAYERS, addStarXIPlayer, beginSeasonCupMatch, beginCupMatch, advanceCupMatch, getBestStarXISelection, getStarXISelection, getStarXIRating, getTransferBonuses, initialGameFeatures, normalizeGameFeatures, openStarPack, setBestStarXI, setStarXIBenchPlayer, shouldTriggerPackTroll } from '../app/feature-data.ts';
import { emptyPlayerStats, getCareerCard, getMilestoneCategory, getPlayerMilestones, normalizeCareerState, claimAllAlbumRewards, getAlbumGroups } from '../app/career-data.ts';
import { getPackUnlockSeason, getUpgradeUnlockSeason } from '../app/season-progression.ts';
function random(seed=1) { return () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296); }
const player = (position:string) => STAR_XI_PLAYERS.find(p=>p.position===position) ?? {...STAR_XI_PLAYERS[0],position:position as (typeof STAR_XI_PLAYERS)[number]['position'],positions:[position as (typeof STAR_XI_PLAYERS)[number]['position']]};
test('every primary position receives increasing realistic goals with unchanged nonstacking rewards',()=>{
 for(const [pos,category] of [['TW','goalkeeper'],['IV','defender'],['LV','defender'],['RV','defender'],['ZDM','midfielder'],['ZM','midfielder'],['ZOM','midfielder'],['LM','winger'],['RM','winger'],['LF','winger'],['RF','winger'],['ST','striker'],['MS','striker']]) {
  const p=player(pos);assert.equal(getMilestoneCategory(p),category);
  const f=initialGameFeatures(),defs=getPlayerMilestones(f.career,p);
  if(pos==='TW') assert.ok(defs.every(m=>!['goals','assists'].includes(m.metric)));
  for(const metric of new Set(defs.map(m=>m.metric))) {
   const tiers=defs.filter(m=>m.metric===metric);assert.equal(tiers.length,3);
   assert.ok(tiers[0].target<tiers[1].target&&tiers[1].target<tiers[2].target);assert.deepEqual(tiers.map(m=>m.bonus),[1,2,3]);
  }
  f.career.players[p.id]={...emptyPlayerStats(),appearances:100,minutes:9000,goals:100,assists:100};
  const restored=normalizeCareerState(f.career,[p.id]);assert.equal(restored.milestoneCards[p.id].length,defs.length);assert.equal(getCareerCard(restored,p).bonus,Math.min(3,100-p.rating));
  assert.deepEqual(normalizeCareerState(JSON.parse(JSON.stringify(restored))),restored);
 }
});
test('multi-position categories stay fixed across match slots, saved reloads and changed primary position',()=>{
 const p=STAR_XI_PLAYERS.find(p=>p.positions&&p.positions.length>1)!;
 const c=normalizeCareerState({version:2},[p.id]),cat=c.milestoneCategories[p.id];
 assert.deepEqual(getPlayerMilestones(c,p),getPlayerMilestones(c,{...p,position:p.position==='TW'?'ST':'TW'}));
 assert.equal(normalizeCareerState(JSON.parse(JSON.stringify(c)),[p.id]).milestoneCategories[p.id],cat);
});
test('legacy migration preserves exact stats, earned old entitlements and claimed rewards without new goalkeeper scorer unlocks',()=>{
 const p=player('TW'),stats={...emptyPlayerStats(),appearances:25,goals:50,assists:30,motm:10,minutes:2250};
 const c=normalizeCareerState({version:1,players:{[p.id]:stats},milestoneCards:{[p.id]:['scorer','scorer']},claimedAlbumRewards:['base','custom']},[p.id]);
 assert.deepEqual(c.players[p.id],stats);for(const id of ['loyal','scorer','creator','hero'])assert.ok(c.milestoneCards[p.id].includes(id));
 assert.deepEqual(c.claimedAlbumRewards,['base','custom']);assert.equal(getCareerCard(c,p).bonus,Math.min(3,100-p.rating));
 assert.deepEqual(normalizeCareerState(JSON.parse(JSON.stringify(c))),c);
 const fresh=normalizeCareerState({version:2,players:{[p.id]:stats}},[p.id]);assert.ok(!fresh.milestoneCards[p.id].includes('scorer'));
});
test('bulk album claim preserves previous claims and pays all newly completed groups exactly once',()=>{
 let f=initialGameFeatures();f.starXI.ownedIds=STAR_XI_PLAYERS.map(p=>p.id);f=normalizeGameFeatures(f);
 const groups=getAlbumGroups(f.career),old=groups[0];f.career.claimedAlbumRewards=[old.id];
 const expected=groups.filter(g=>g.id!==old.id).reduce((n,g)=>n+g.reward,0);
 assert.equal(claimAllAlbumRewards(f),groups.length-1);assert.equal(f.starXI.fragments,expected);
 f=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));assert.equal(claimAllAlbumRewards(f),0);assert.equal(f.starXI.fragments,expected);
});
