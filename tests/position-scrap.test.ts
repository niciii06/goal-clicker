import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { SCRAP_PLAYERS, STAR_FORMATIONS, STAR_PACKS, STAR_XI_PLAYERS, addStarXIPlayer, beginSeasonCupMatch, beginCupMatch, advanceCupMatch, getBestStarXISelection, getStarXISelection, getStarXIRating, getTransferBonuses, initialGameFeatures, normalizeGameFeatures, openStarPack, setBestStarXI, setStarXIBenchPlayer, shouldTriggerPackTroll } from '../app/feature-data.ts';
import { emptyPlayerStats, getCareerCard, getMilestoneCategory, getPlayerMilestones, normalizeCareerState, claimAllAlbumRewards, getAlbumGroups } from '../app/career-data.ts';
import { getPackUnlockSeason, getUpgradeUnlockSeason } from '../app/season-progression.ts';
function random(seed=1) { return () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296); }
const player = (position:string) => STAR_XI_PLAYERS.find(p=>p.position===position)!;
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
test('scrap price, strict pool, no rare reveals, and original pack prices/unlocks',()=>{
 assert.equal(STAR_PACKS.find(p=>p.id==='scrap')!.price,7500);assert.equal(getPackUnlockSeason('scrap'),1);
 assert.deepEqual(STAR_PACKS.find(p=>p.id==='scrap')!.odds,[{label:'Schrott 40–64',minRating:40,maxRating:64,chance:1}]);
 assert.deepEqual(STAR_PACKS.filter(p=>p.id!=='scrap').map(p=>p.price),[25000,250000000,5000000000]);
 assert.deepEqual(['scout','elite','legend'].map(getPackUnlockSeason),[1,5,10]);
 const rng=random(37);for(let i=0;i<1000;i++){const draw=openStarPack('scrap',SCRAP_PLAYERS.map(p=>p.id),rng);assert.ok(draw.player.rating>=40&&draw.player.rating<=64);assert.equal(draw.player.cardType,'base');assert.ok(!draw.player.isCustom);assert.equal(shouldTriggerPackTroll(draw.player,()=>0),false);}
 assert.equal(SCRAP_PLAYERS.length,60);assert.equal(new Set(SCRAP_PLAYERS.map(p=>p.id)).size,60);
});
test('eleven purchases fill every supported formation without duplicates; cards survive reload and occupy the bench',()=>{
 for(const formation of STAR_FORMATIONS){let f=initialGameFeatures();f.starXI.formationId=formation.id;f.starXI.formationPositions=formation.slots.map(s=>s.position);const rng=random(42);
  for(let n=0;n<11;n++){const draw=openStarPack('scrap',f.starXI.ownedIds,rng,f.starXI.formationPositions);assert.equal(draw.duplicate,false);f.starXI=addStarXIPlayer(f.starXI,draw.player.id);f=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));assert.equal(getBestStarXISelection(f.starXI.ownedIds,f.starXI.formationPositions).filter(Boolean).length,n+1);}
  f.starXI=setBestStarXI(f.starXI);assert.equal(getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds).length,11);
  const d=openStarPack('scrap',f.starXI.ownedIds,rng,f.starXI.formationPositions);f.starXI=addStarXIPlayer(f.starXI,d.player.id);f.starXI=setStarXIBenchPlayer(f.starXI,0,d.player.id);assert.equal(f.starXI.benchIds[0],d.player.id);
  f.cup=beginSeasonCupMatch(f.cup,f.seasonMode,100000,getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions);assert.equal(f.cup.active,true);
 }
});
test('scrap purchases also complete an existing mixed multi-position squad automatically',()=>{
 for(let seed=1;seed<=20;seed++){let f=initialGameFeatures();const rng=random(seed);
  for(let n=0;n<5;n++){const d=openStarPack('scout',f.starXI.ownedIds,rng);if(!d.duplicate)f.starXI=addStarXIPlayer(f.starXI,d.player.id);}
  const before=getBestStarXISelection(f.starXI.ownedIds,f.starXI.formationPositions).filter(Boolean).length;
  for(let n=before;n<11;n++){const d=openStarPack('scrap',f.starXI.ownedIds,rng,f.starXI.formationPositions);f.starXI=addStarXIPlayer(f.starXI,d.player.id);assert.equal(f.starXI.lineupIds.filter(Boolean).length,n+1);}
 }
});
test('scrap avoids duplicates until exhaustion and maintains existing tournament compatibility',()=>{
 let f=initialGameFeatures();const rng=random(8);
 for(let n=0;n<60;n++){const draw=openStarPack('scrap',f.starXI.ownedIds,rng);assert.equal(draw.duplicate,false);f.starXI=addStarXIPlayer(f.starXI,draw.player.id);}
 const duplicate=openStarPack('scrap',f.starXI.ownedIds,rng);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.fragmentCompensation,15);
 f.starXI=setBestStarXI(f.starXI);assert.ok(getStarXIRating(f.starXI.ownedIds,f.starXI.lineupIds)>=55);
 f.cup=beginCupMatch(f.cup,100000,'stadium',getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions);
 assert.equal(f.cup.active,true);f.cup.homeScore=1;f.cup.awayScore=0;f.cup.lastTickAt=f.cup.matchEndsAt;
 const result=advanceCupMatch(f.cup,getStarXIRating(f.starXI.ownedIds,f.starXI.lineupIds),f.cup.matchEndsAt+1,rng);assert.equal(result.finished,true);assert.equal(result.cup.active,false);
});
// Conservative reproducible scenario: three clicks/second, no crits, streak,
// minigames, missions, gifts or random-event income. Uses production functions from the app.
test('new save earns a valid eleven within twenty minutes using only unlocked upgrades',()=>{
 const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 const declarations=['getLevel','getIncomeMultiplier','getBaseClickPower','getBasePassivePower'].map(name=>source.match(new RegExp(`function ${name}\\([^]*?\\n}`))![0]).join('\n');
 const upgrades=source.match(/const UPGRADES: UpgradeDefinition\[\] = \[[^]*?\n\];/)![0];
 const script=ts.transpileModule(`${upgrades}\n${declarations}\nglobalThis.production={upgrades:UPGRADES,click:getBaseClickPower,passive:getBasePassivePower};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const context:{production?:{upgrades:{id:string;baseCost:number;scale:number}[];click:(u:Record<string,number>)=>number;passive:(u:Record<string,number>)=>number};getTransferBonuses:typeof getTransferBonuses;MAX_MULTIPLIER_LEVEL:number;MAX_SEASON_STARS:number}={getTransferBonuses,MAX_MULTIPLIER_LEVEL:8,MAX_SEASON_STARS:20};runInNewContext(script,context);
 const prod=context.production!,levels:Record<string,number>={};let coins=0,spent=0,seconds=0,packs=0;let f=initialGameFeatures();const rng=random(99);
 const unlocked=prod.upgrades.filter(u=>getUpgradeUnlockSeason(u.id)===1);
 while(packs<11&&seconds<1200){seconds++;coins+=3*prod.click(levels)+prod.passive(levels);
  const choices=unlocked.map(u=>{const price=Math.floor(u.baseCost*u.scale**(levels[u.id]??0));const increased={...levels,[u.id]:(levels[u.id]??0)+1};const gain=3*(prod.click(increased)-prod.click(levels))+prod.passive(increased)-prod.passive(levels);return {u,price,gain};}).filter(x=>x.price<=coins&&x.price/x.gain<=90).sort((a,b)=>a.price/a.gain-b.price/b.gain);
  if(choices.length){const {u,price}=choices[0];coins-=price;spent+=price;levels[u.id]=(levels[u.id]??0)+1;}
  if(coins>=7500){coins-=7500;const draw=openStarPack('scrap',f.starXI.ownedIds,rng,f.starXI.formationPositions);assert.ok(!draw.duplicate);f.starXI=addStarXIPlayer(f.starXI,draw.player.id);packs++;}
 }
 assert.equal(packs,11);f.starXI=setBestStarXI(f.starXI);assert.equal(getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds).length,11);
 f.cup=beginSeasonCupMatch(f.cup,f.seasonMode,100000,getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions);assert.equal(f.cup.active,true);
 console.log('EARLYGAME',JSON.stringify({seconds,packs,packCost:82500,upgradeCost:spent,coinsLeft:Math.floor(coins),rating:getStarXIRating(f.starXI.ownedIds,f.starXI.lineupIds),levels}));
});
