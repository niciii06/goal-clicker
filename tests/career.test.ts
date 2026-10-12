import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beginSeasonCupMatch, initialGameFeatures, normalizeGameFeatures, pauseGameFeatureTimers, setBestStarXI, STAR_XI_PLAYERS, getStarXISelection, advanceCupMatch, getStarXIEffectiveMatchRating, recordSeasonModeMatch, startSeasonPrestige } from '../app/feature-data.ts';
import { claimAlbumReward, emptyPlayerStats, getAlbumGroups, getCareerCard, getMatchRatingBreakdown, getPlayerForm, getPlayerMilestones, normalizeCareerState, prepareCareerMatch, recordCareerMatch, rivalryKey } from '../app/career-data.ts';
import { AlbumPanel, CareerPanel, MatchRatingsPanel } from '../app/career-panels.tsx';

function fixture(now=1000000) {
  let f=initialGameFeatures(now);
  f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.filter(p=>p.rating<95).slice(0,200).map(p=>p.id)});
  f=normalizeGameFeatures(f);
  f.cup=beginSeasonCupMatch(f.cup,f.seasonMode,now,getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions,f.starXI.lineupIds,f.starXI.benchIds);
  prepareCareerMatch(f);
  return f;
}
function finishFixture(f: ReturnType<typeof fixture>, goals=1) {
  const scorer=f.starXI.lineupIds.find(id=>id&&STAR_XI_PLAYERS.find(p=>p.id===id)?.position!=='TW')!, assist=f.starXI.lineupIds.find(id=>id&&id!==scorer)!;
  f.cup.homeScore=goals;f.cup.awayScore=0;
  f.cup.matchEvents=Array.from({length:goals},(_,i)=>({id:`goal-${i}`,side:'home' as const,scorerId:scorer,scorer:'Player',minute:30+i,createdAt:1000000+60000+i,homeScore:i+1,awayScore:0,ratingImpacts:{[scorer]:.7,[assist]:.25}}));
  f.cup.active=false;
  return {scorer,assist};
}
test('legacy saves preserve the roster, trophies, counters and collected players, without inventing form',()=>{
 const f=fixture(); const {scorer}=finishFixture(f);f.cup.allTimeScorers={[scorer]:70};f.cup.allTimeAppearances={[scorer]:30};f.cup.trophies.world=5;
 const raw=JSON.parse(JSON.stringify(f));delete raw.career;raw.schemaVersion=3;
 const migrated=normalizeGameFeatures(raw);
 assert.deepEqual(migrated.starXI,f.starXI);assert.equal(migrated.cup.trophies.world,5);
 assert.equal(migrated.career.players[scorer].goals,70);assert.equal(getPlayerForm(migrated.career,scorer).bonus,0);
 assert.ok(migrated.career.collectedIds.includes(scorer));assert.ok(migrated.career.milestoneCards[scorer].includes('scorer'));
 assert.deepEqual(normalizeGameFeatures(JSON.parse(JSON.stringify(migrated))).career,migrated.career);
});
test('migration during an active game subtracts its live counters so its finish is counted once',()=>{
 const f=fixture(); const {scorer}=finishFixture(f,2);f.cup.active=true;f.cup.allTimeScorers={[scorer]:12};f.cup.allTimeAppearances={[scorer]:6};
 const raw=JSON.parse(JSON.stringify(f));delete raw.career;
 const migrated=normalizeGameFeatures(raw);assert.equal(migrated.career.players[scorer].goals,10);assert.equal(migrated.career.players[scorer].appearances,5);
 migrated.cup.active=false;recordCareerMatch(migrated);assert.equal(migrated.career.players[scorer].goals,12);assert.equal(migrated.career.players[scorer].appearances,6);
});
test('rating details show actual goal/assist/conceded contributions and freeze substituted player minutes',()=>{
 const f=fixture();const {scorer,assist}=finishFixture(f,2);
 f.cup.playerExitedAt[scorer]=60;
 const report=getMatchRatingBreakdown(f.cup,scorer,90)!;
 assert.equal(report.goals,2);assert.equal(report.assists,0);assert.equal(report.minutes,60);
 assert.equal(getMatchRatingBreakdown(f.cup,assist,90)!.assists,2);
 assert.ok(Math.abs(report.reasons.reduce((n,r)=>n+r.value,0)-report.rating)<1e-8);
 f.cup.matchEvents.push({id:'conceded',side:'away',scorerId:null,scorer:'Opponent',minute:65,createdAt:1130000,homeScore:2,awayScore:1,ratingImpacts:{[scorer]:-.9,[assist]:-.6}});
 assert.equal(getMatchRatingBreakdown(f.cup,scorer,90)!.rating,report.rating);
 assert.ok(getMatchRatingBreakdown(f.cup,assist,90)!.reasons.some(r=>r.label.includes('Gegentoren')&&r.value<0));
});
test('short substitutions do not change persistent form, and form uses only five performances with bounded effects',()=>{
 const f=fixture();const {scorer}=finishFixture(f);f.career.players[scorer]={...emptyPlayerStats(),recent:[10,10,10,10,10]};
 assert.equal(getPlayerForm(f.career,scorer).bonus,2);
 f.cup.playerEnteredAt[scorer]=85;
 recordCareerMatch(f);assert.deepEqual(f.career.players[scorer].recent,[10,10,10,10,10]);
 const low=normalizeCareerState({version:1,players:{[scorer]:{recent:[1,1,1,1,1,1]}}});assert.equal(low.players[scorer].recent.length,5);assert.equal(getPlayerForm(low,scorer).bonus,-2);
});
test('special variants unlock at exact milestones, do not stack, and affect the next match',()=>{
 const f=fixture();const {scorer}=finishFixture(f);f.career.players[scorer]={...emptyPlayerStats(),goals:49,appearances:24};
 recordCareerMatch(f);const pGoals=getPlayerMilestones(f.career,STAR_XI_PLAYERS.find(p=>p.id===scorer)!);assert.deepEqual(f.career.milestoneCards[scorer],pGoals.filter(m=>f.career.players[scorer][m.metric]>=m.target).map(m=>m.id));
 const p=STAR_XI_PLAYERS.find(p=>p.id===scorer)!;const card=getCareerCard(f.career,p);assert.equal(card.bonus,Math.min(Math.max(...pGoals.filter(m=>f.career.milestoneCards[scorer].includes(m.id)).map(m=>m.bonus)),100-p.rating));
 f.career.players[scorer].recent=[10,10,10,10,10];
 f.cup=beginSeasonCupMatch(f.cup,f.seasonMode,1200000,getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions,f.starXI.lineupIds,f.starXI.benchIds);
 const neutral=getStarXIEffectiveMatchRating(f.starXI.ownedIds,f.starXI.lineupIds,f.cup,1);prepareCareerMatch(f);
 assert.equal(f.cup.careerBonuses?.[scorer],2+card.bonus);assert.ok(getStarXIEffectiveMatchRating(f.starXI.ownedIds,f.starXI.lineupIds,f.cup,1)>neutral);
 assert.equal(getCareerCard(f.career,{...p,rating:100}).rating,100);
});
test('finish is idempotent even after JSON restoration or offline timer adjustment',()=>{
 const f=fixture();finishFixture(f);recordCareerMatch(f,1200000);const first=JSON.stringify(f.career),fragments=f.starXI.fragments;
 recordCareerMatch(f,1300000);assert.equal(JSON.stringify(f.career),first);assert.equal(f.starXI.fragments,fragments);
 const restored=pauseGameFeatureTimers(JSON.parse(JSON.stringify(f)),20000,1400000);recordCareerMatch(restored,1500000);assert.equal(JSON.stringify(restored.career),first);
 const active=fixture();const id=active.cup.careerMatchId;const resumed=pauseGameFeatureTimers(active,90000,1400000);assert.equal(resumed.cup.careerMatchId,id);
});
test('season awards use league games, eligibility thresholds and reset only season stats',()=>{
 const f=fixture();const {scorer,assist}=finishFixture(f,2);const now=1200000;
 f.career.seasonMatches=9;f.seasonMode.matchday=9;
 f.career.seasonPlayers[scorer]={...emptyPlayerStats(),appearances:4,minutes:300,ratingTotal:32,ratedMatches:4,goals:5};
 f.career.seasonPlayers[assist]={...emptyPlayerStats(),appearances:3,minutes:200,ratingTotal:16,ratedMatches:3,subAppearances:2,subMinutes:100,subRatingTotal:15};
 const result=recordSeasonModeMatch(f.seasonMode,2,0,f.club.name,now,()=>.5,f.cup.opponentIds[0]);
 recordCareerMatch(f,now,result.entry);
 const a=f.career.awards[0];assert.equal(a.matchesTracked,10);assert.equal(a.scorer?.playerId,scorer);assert.equal(a.joker?.playerId,assist);assert.equal(a.disappointment?.playerId,assist);assert.ok(a.best);
 assert.deepEqual(f.career.seasonPlayers,{});assert.equal(f.career.seasonNumber,2);assert.equal(f.career.players[scorer].goals,2);
 recordCareerMatch(f,now,result.entry);assert.equal(f.career.awards.length,1);
 f.seasonMode={...f.seasonMode,hallOfFame:true};f.seasonMode=startSeasonPrestige(f.seasonMode);assert.equal(f.career.awards.length,1);
});
test('insufficient season samples and no poor players give honest empty awards',()=>{
 const f=fixture();finishFixture(f);recordCareerMatch(f,1200000,{id:'season',division:1,matchday:10,opponent:f.cup.opponent,opponentRating:60,clubScore:1,opponentScore:0,outcome:'win',completedSeason:true,seasonOutcome:'stayed',createdAt:1200000});
 assert.equal(f.career.awards[0].best,null);assert.equal(f.career.awards[0].joker,null);assert.equal(f.career.awards[0].disappointment,null);
});
test('rivalries activate after close duels, then award a derby once and preserve the direct balance',()=>{
 const f=fixture();const opponent=f.cup.opponent;
 for(let i=0;i<3;i++){ if(i){f.cup=beginSeasonCupMatch(f.cup,f.seasonMode,1000000+i*200000,getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds));prepareCareerMatch(f);}finishFixture(f);recordCareerMatch(f,1200000+i*200000); }
 const rival=f.career.rivals[rivalryKey(opponent)];assert.equal(rival.active,true);assert.equal(rival.wins,3);assert.equal(f.starXI.fragments,0);
 f.cup=beginSeasonCupMatch(f.cup,f.seasonMode,1800000,getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds));prepareCareerMatch(f);finishFixture(f);recordCareerMatch(f,2000000);assert.equal(f.starXI.fragments,400);assert.equal(f.career.reports.at(-1)?.derby,true);
 recordCareerMatch(f,2000001);assert.equal(f.starXI.fragments,400);assert.equal(rivalryKey('  FC   TEST '),rivalryKey('fc test'));
});
test('album tracks sold cards and pays only validated completed groups once',()=>{
 const f=fixture(),singleNation=getAlbumGroups(f.career).find(g=>g.id.startsWith('nation-')&&g.total===1)!;assert.ok(singleNation);
 const id=STAR_XI_PLAYERS.find(p=>p.countryCode===singleNation.id.slice(7))!.id;
 f.starXI.ownedIds.push(id);const normalized=normalizeGameFeatures(f);normalized.starXI.ownedIds=normalized.starXI.ownedIds.filter(p=>p!==id);
 assert.ok(normalized.career.collectedIds.includes(id));assert.equal(claimAlbumReward(normalized,'invalid'),false);assert.equal(claimAlbumReward(normalized,'base'),false);
 const before=normalized.starXI.fragments;assert.equal(claimAlbumReward(normalized,singleNation.id),true);assert.equal(normalized.starXI.fragments,before+500);assert.equal(claimAlbumReward(normalized,singleNation.id),false);
 const reloaded=normalizeGameFeatures(JSON.parse(JSON.stringify(normalized)));assert.equal(claimAlbumReward(reloaded,singleNation.id),false);
});
test('career, album and match panels render real populated states with accessible controls and report details',()=>{
 const f=fixture();finishFixture(f,3);recordCareerMatch(f);
 const career=renderToStaticMarkup(React.createElement(CareerPanel,{features:f})),album=renderToStaticMarkup(React.createElement(AlbumPanel,{features:f,busy:false,onClaim:()=>{}})),report=renderToStaticMarkup(React.createElement(MatchRatingsPanel,{features:f,minute:90}));
 assert.match(career,/SPIELERFORM/);assert.match(career,/MEILENSTEINE/);assert.match(career,/SAISONABSCHLUSS/);assert.match(career,/RIVALITÄTEN/);
 assert.match(album,/aria-label="Album Nation"/);assert.match(album,/aria-label="Album Rating"/);assert.match(album,/Prämien|PRÄMIEN/);assert.match(report,/Spieler des Spiels/);assert.match(report,/<details/);assert.match(report,/Vorlage/);
 assert.doesNotMatch(career+album+report,/NaN|undefined/);
});
test('real match engine completion survives normalization and generates a single report',()=>{
 const f=fixture();f.cup.homeScore=1;
 const result=advanceCupMatch(f.cup,80,f.cup.matchEndsAt,()=>.5,getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions);
 assert.equal(result.finished,true);f.cup=result.cup;
 const season=recordSeasonModeMatch(f.seasonMode,f.cup.homeScore,f.cup.awayScore,f.club.name,f.cup.matchEndsAt,()=>.5,f.cup.opponentIds[0]);
 recordCareerMatch(f,f.cup.matchEndsAt,season.entry);
 const restored=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));assert.equal(restored.career.reports.length,1);assert.equal(restored.career.reports[0].players.length,11);assert.ok(restored.career.reports[0].motmId);
});
test('offline pause retains the match rating seed and all rating explanations',()=>{
 const f=fixture();finishFixture(f,2);f.cup.active=true;
 const id=f.starXI.lineupIds[1],before=getMatchRatingBreakdown(f.cup,id,60);
 const paused=pauseGameFeatureTimers(f,500000,1700000);
 assert.deepEqual(getMatchRatingBreakdown(paused.cup,id,60),before);
 assert.equal(paused.cup.careerRatingSeed,f.cup.careerRatingSeed);
});
test('derby draws and losses update the balance without a win reward',()=>{
 const f=fixture();finishFixture(f);f.cup.homeScore=0;f.cup.matchEvents=[];
 const key=rivalryKey(f.cup.opponent);f.career.rivals[key]={opponent:f.cup.opponent,played:3,wins:1,draws:1,losses:1,goalsFor:2,goalsAgainst:2,closeGames:3,active:true,lastResults:[],lastPlayedAt:1};
 recordCareerMatch(f);assert.equal(f.starXI.fragments,150);assert.equal(f.career.rivals[key].draws,2);
 f.cup.careerMatchId='loss-match';f.cup.awayScore=2;recordCareerMatch(f);assert.equal(f.starXI.fragments,150);assert.equal(f.career.rivals[key].losses,2);
});
test('penalty shootouts settle rivalry wins but never count shootout goals as career goals',()=>{
 const f=fixture();finishFixture(f);f.cup.homeScore=1;f.cup.awayScore=1;f.cup.penaltyHomeScore=5;f.cup.penaltyAwayScore=4;
 f.cup.penaltyEvents=[{id:'pen',side:'home',playerId:f.starXI.lineupIds[0],player:'P',direction:'left',keeperDirection:'right',outcome:'goal',createdAt:1,homeScore:5,awayScore:4,homeTaken:5,awayTaken:5}];
 recordCareerMatch(f);const rival=f.career.rivals[rivalryKey(f.cup.opponent)];assert.equal(rival.wins,1);assert.equal(rival.draws,0);assert.equal(Object.values(f.career.players).reduce((n,s)=>n+s.goals,0),1);
});
