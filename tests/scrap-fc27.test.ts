import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import source from '../app/fc27-india-source.json';
import { FC27_INDIA_PROFILES, SCRAP_RATING_GROUPS, drawScrapPlayer } from '../app/scrap-pack.ts';
import { SCRAP_PLAYERS, STAR_PACKS, STAR_XI_PLAYERS, STAR_FORMATIONS, addStarXIPlayer, initialGameFeatures, normalizeGameFeatures, openStarPack, canStarXIPlayerPlayPosition, setBestStarXI, getStarXISelection, beginSeasonCupMatch, advanceCupMatch, getStarXIRating } from '../app/feature-data.ts';
import { emptyPlayerStats, getCareerCard, getPlayerMilestones, getAlbumGroups, normalizeCareerState } from '../app/career-data.ts';
function random(seed=71) { return () => ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296); }
test('complete official source: all IDs, original ratings, names, positions, attributes and unique catalogue entries',()=>{
 assert.equal(source.edition,'FC 27'); assert.equal(source.totalItems,218);assert.equal(source.items.length,source.totalItems);
 assert.equal(SCRAP_PLAYERS.length,source.totalItems);
 assert.deepEqual(new Set(SCRAP_PLAYERS.map(p=>p.sourceId)),new Set(source.items.map(p=>String(p.id))));
 assert.deepEqual(SCRAP_RATING_GROUPS.map(g=>SCRAP_PLAYERS.filter(p=>p.rating>=g.minRating&&p.rating<=g.maxRating).length),[137,57,10,14]);
 for(const original of source.items){
  assert.equal(original.nationality.id,159);
  const profile=FC27_INDIA_PROFILES.find(p=>p.sourceId===String(original.id))!, card=SCRAP_PLAYERS.find(p=>p.sourceId===profile.sourceId)!;
  assert.equal(card.rating,original.overallRating); assert.equal(card.name,original.commonName||`${original.firstName} ${original.lastName}`.trim());
  const map:Record<string,string>={GK:'TW',LB:'LV',CB:'IV',RB:'RV',CDM:'ZDM',CM:'ZM',CAM:'ZOM',LM:'LM',RM:'RM',LW:'LF',RW:'RF',ST:'ST'};
  assert.deepEqual(card.positions,[...new Set([original.position,...(original.alternatePositions??[])].map(p=>map[p.shortLabel]))]);
  assert.equal(card.position,map[original.position.shortLabel]);assert.deepEqual(card.originalAttributes,original);
  assert.equal(STAR_XI_PLAYERS.filter(p=>p.sourceId===card.sourceId).length,1);
 }
});
test('100000 production draws match group rates and uniform player rates with duplicates independent of ownership',()=>{
 const rng=random(),counts=new Map<string,number>(),groups=[0,0,0,0],n=100000;
 for(let i=0;i<n;i++){
  const draw=openStarPack('scrap',[],rng);assert.equal(draw.player.countryCode,'IN');assert.ok(SCRAP_PLAYERS.includes(draw.player));
  counts.set(draw.player.id,(counts.get(draw.player.id)??0)+1);
  groups[SCRAP_RATING_GROUPS.findIndex(g=>draw.player.rating>=g.minRating&&draw.player.rating<=g.maxRating)]++;
 }
 let chi=0;
 for(let i=0;i<4;i++){
  const g=SCRAP_RATING_GROUPS[i],expected=n*g.chance;assert.ok(Math.abs(groups[i]-expected)<5*Math.sqrt(n*g.chance*(1-g.chance)));
  const cards=SCRAP_PLAYERS.filter(p=>p.rating>=g.minRating&&p.rating<=g.maxRating),perCard=expected/cards.length;
  for(const card of cards){const observed=counts.get(card.id)??0;assert.ok(observed>0);chi+=(observed-perCard)**2/perCard;}
 }
 assert.ok(chi<300,`chi-square=${chi}`);console.log('DROP-RATE RESULT',JSON.stringify({n,groups,percent:groups.map(x=>x/n*100),chiSquare:chi}));
 for(let seed=1;seed<100;seed++){
  const a=openStarPack('scrap',[],random(seed)),b=openStarPack('scrap',SCRAP_PLAYERS.map(p=>p.id),random(seed));
  assert.equal(a.player.id,b.player.id);assert.equal(b.duplicate,true);assert.ok(b.fragmentCompensation>0);
 }
});
test('every player is reachable at deterministic group/player quantiles; empty groups redistribute proportionally',()=>{
 let cumulative=0;
 for(const group of SCRAP_RATING_GROUPS){
  const cards=SCRAP_PLAYERS.filter(p=>p.rating>=group.minRating&&p.rating<=group.maxRating);
  cards.forEach((card,index)=>{const rolls=[cumulative+group.chance/2,(index+0.5)/cards.length];assert.equal(openStarPack('scrap',[],()=>rolls.shift()!).player.id,card.id);});
  cumulative+=group.chance;
 }
 const pool=[{rating:50},{rating:60}],rng=random(9);let low=0;
 for(let i=0;i<10000;i++)low+=Number(drawScrapPlayer(pool,rng).rating===50);
 assert.ok(Math.abs(low-10000*0.5/0.63)<200);
 assert.equal(drawScrapPlayer([{rating:65}],()=>0).rating,65);
 assert.throws(()=>drawScrapPlayer([],()=>0));assert.throws(()=>drawScrapPlayer([{rating:70}],()=>0));
});
test('all new cards survive saves, play original positions, receive milestones/upgrades and count in collections',()=>{
 for(const card of SCRAP_PLAYERS){
  let f=initialGameFeatures();f.starXI=addStarXIPlayer(f.starXI,card.id);f=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));
  assert.ok(f.starXI.ownedIds.includes(card.id));assert.ok(f.starXI.lineupIds.includes(card.id)||f.starXI.benchIds.includes(card.id));
  for(const pos of card.positions)assert.ok(canStarXIPlayerPlayPosition(card,pos));
  f.career.players[card.id]={...emptyPlayerStats(),appearances:100,minutes:9000,goals:100,assists:100};
  f.career=normalizeCareerState(f.career,[card.id]);assert.ok(getPlayerMilestones(f.career,card).length);assert.ok(getCareerCard(f.career,card).bonus>0);
 }
 let f=initialGameFeatures();f.starXI.ownedIds=SCRAP_PLAYERS.map(p=>p.id);f=normalizeGameFeatures(f);
 const album=getAlbumGroups(f.career).find(g=>g.id==='scrap')!;assert.equal(album.total,218);assert.equal(album.collected,218);
 for(const formation of STAR_FORMATIONS){f.starXI.formationId=formation.id;f.starXI.formationPositions=formation.slots.map(s=>s.position);f.starXI=setBestStarXI(f.starXI);for(let i=0;i<f.starXI.lineupIds.length;i++){const card=SCRAP_PLAYERS.find(p=>p.id===f.starXI.lineupIds[i]);if(card)assert.ok(canStarXIPlayerPlayPosition(card,f.starXI.formationPositions[i]));}}
 f.starXI.formationId='433';f.starXI.formationPositions=STAR_FORMATIONS.find(p=>p.id==='433')!.slots.map(s=>s.position);f.starXI=setBestStarXI(f.starXI);assert.equal(getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds).length,11);
 f.cup=beginSeasonCupMatch(f.cup,f.seasonMode,100000,getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions);assert.equal(f.cup.active,true);
 f.cup.homeScore=1;f.cup.awayScore=0;f.cup.lastTickAt=f.cup.matchEndsAt;assert.equal(advanceCupMatch(f.cup,getStarXIRating(f.starXI.ownedIds,f.starXI.lineupIds),f.cup.matchEndsAt+1,random()).finished,true);
 const old=initialGameFeatures();old.starXI.ownedIds=['scrap-tw-1'];old.starXI.lineupIds[0]='scrap-tw-1';old.starXI.benchIds[0]='scrap-st-1';const restored=normalizeGameFeatures(JSON.parse(JSON.stringify(old)));assert.deepEqual(restored.starXI.ownedIds,[]);assert.ok(!restored.starXI.lineupIds.some(id=>id.startsWith('scrap-')));assert.ok(!restored.starXI.benchIds.some(id=>id.startsWith('scrap-')));assert.ok(STAR_XI_PLAYERS.every(p=>!/^scrap-(?!ea-)/.test(p.id)));
});
test('public pack metadata shows rating odds without the nationality restriction; other pack pools, prices and definitions remain unchanged',()=>{
 const scrap=STAR_PACKS.find(p=>p.id==='scrap')!;assert.equal(scrap.price,15000);assert.equal(scrap.label,'Schrott-Pack');assert.deepEqual(scrap.odds.map(({minRating,maxRating,chance})=>({minRating,maxRating,chance})),SCRAP_RATING_GROUPS);assert.deepEqual(scrap.odds.map(o=>o.label),["Gewöhnlich bis 54","Gewöhnlich 55–59","Gewöhnlich 60–64","Gewöhnlich 65–69"]);
 assert.doesNotMatch(JSON.stringify(scrap),/India|Indien|indisch|keine Duplikate|freie Positionen/i);
 const ui=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');assert.doesNotMatch(ui,/SCRAP_RATING_GROUPS|FC27_INDIA|60 schwache Schrottkarten/);
 assert.deepEqual(STAR_PACKS.filter(p=>p.id!=='scrap').map(p=>p.price),[2000000,25000000,130000000,1500000000,5000000000,10000000000]);
 for(const id of ['regional','scout','profi','elite','weltklasse','legend'] as const){const rng=random(8);for(let i=0;i<1000;i++)assert.ok(!SCRAP_PLAYERS.includes(openStarPack(id,[],rng).player));}
});
