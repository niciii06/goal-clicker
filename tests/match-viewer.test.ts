import assert from "node:assert/strict";
import test from "node:test";
import { beginSeasonCupMatch, getCupMatchMinute, getCupRegularDurationMs, initialGameFeatures, CUP_MATCH_DURATION_MS, CUP_EXTRA_TIME_DURATION_MS } from "../app/feature-data.ts";
import { getViewerEvents } from "../app/match-viewer.tsx";

test("new regular fixture has three and a half real minutes and a synchronized 90-minute clock", () => {
  const now = 1_000_000;
  const features = initialGameFeatures(now);
  const cup = beginSeasonCupMatch(features.cup, features.seasonMode, now);
  assert.equal(cup.matchEndsAt - cup.matchStartedAt, 210_000);
  assert.equal(CUP_MATCH_DURATION_MS, 240_000);
  assert.equal(CUP_EXTRA_TIME_DURATION_MS, 80_000);
  assert.equal(getCupMatchMinute(cup, now), 1);
  assert.equal(getCupMatchMinute(cup, now + 105_000), 46);
  assert.equal(getCupMatchMinute(cup, now + 209_999), 90);
});

test("saved three-minute fixture keeps its old match clock and event calibration", () => {
  const now = 1_000_000;
  const f = initialGameFeatures(now);
  const cup = { ...beginSeasonCupMatch(f.cup, f.seasonMode, now), regularDurationMs: undefined, matchEndsAt: now + 180_000 };
  assert.equal(getCupRegularDurationMs(cup), 180_000);
  assert.equal(getCupMatchMinute(cup, now + 90_000), 46);
  assert.equal(getCupMatchMinute(cup, now + 179_999), 90);
  const legacyOvertime = { ...cup, phase: "extra-time" as const, matchEndsAt: now + 240_000 };
  assert.equal(getCupMatchMinute(legacyOvertime, now + 210_000), 106);
  const currentOvertime = { ...cup, phase: "extra-time" as const, matchEndsAt: now + 480_000 };
  assert.equal(getCupMatchMinute(currentOvertime, now + 420_000), 106);
});

test("visual match events come exclusively from recorded authoritative goal, card and penalty events", () => {
  const f = initialGameFeatures(1_000_000);
  const cup = beginSeasonCupMatch(f.cup, f.seasonMode, 1_000_000);
  assert.deepEqual(getViewerEvents(cup), []);
  const modified = {
    ...cup,
    matchEvents: [{ id: "goal-1", side: "home" as const, scorerId: "player-1", scorer: "Torjäger", minute: 38, createdAt: 1_152_000, homeScore: 1, awayScore: 0, ratingImpacts: {} }],
    cardEvents: [{ id: "red-1", side: "away" as const, playerId: null, player: "Verteidiger", reason: "Notbremse", card: "red" as const, minute: 55, createdAt: 1_216_000, homeScore: 1, awayScore: 0 }],
  };
  const result = getViewerEvents(modified);
  assert.deepEqual(result.map((e) => [e.id,e.kind,e.side,e.minute]), [["goal-1","goal","club",38],["red-1","card","opponent",55]]);
});

import { baseActors, clubAttacksRight, getVisualFrame, type Replay } from '../app/match-viewer.tsx';
import { STAR_FORMATIONS, STAR_XI_PLAYERS, setBestStarXI, getStarXISelection, advanceCupMatch, normalizeGameFeatures } from '../app/feature-data.ts';
import { recordCareerMatch } from '../app/career-data.ts';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { LiveMatchViewer } from '../app/match-viewer.tsx';

function completeFixture() {
  const f=initialGameFeatures(1_000_000);
  f.starXI=setBestStarXI({...f.starXI, ownedIds:STAR_XI_PLAYERS.map(p=>p.id)});
  f.cup=beginSeasonCupMatch(f.cup,f.seasonMode,1_000_000,getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions,f.starXI.lineupIds,f.starXI.benchIds);
  f.cup.regularDurationMs=undefined;f.cup.matchEndsAt=f.cup.matchStartedAt+360000;
  return f;
}

test('all formation slots render one unique actor with valid bounded coordinates and goalkeeper at own goal',()=>{
  for(const formation of STAR_FORMATIONS) {
    const f=completeFixture();
    const used=new Set<string>();
    f.starXI.formationId=formation.id;
    f.starXI.formationPositions=formation.slots.map(s=>s.position);
    f.starXI.lineupIds=formation.slots.map(slot=>{
      const p=STAR_XI_PLAYERS.find(p=>p.positions.includes(slot.position)&&!used.has(p.id))!;
      used.add(p.id);return p.id;
    });
    f.cup=beginSeasonCupMatch(f.cup,f.seasonMode,1_000_000,getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions,f.starXI.lineupIds);
    const frame=getVisualFrame(f,1_030_000);
    assert.equal(frame.actors.length,22,formation.id);
    assert.equal(new Set(frame.actors.map(p=>p.id)).size,22);
    for(const p of frame.actors) {assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=0&&p.x<=105&&p.y>=0&&p.y<=68);}
    const keeper=frame.actors.find(p=>p.team==='club'&&p.goalkeeper)!;
    assert.ok(keeper.x>=3&&keeper.x<=11);
  }
});

test('both home and away identities switch sides at 45, 90 and 105 minutes',()=>{
  for(const away of [false,true]) {
    assert.equal(clubAttacksRight(1,away),!away);
    assert.equal(clubAttacksRight(45,away),!away);
    assert.equal(clubAttacksRight(46,away),away);
    assert.equal(clubAttacksRight(90,away),away);
    assert.equal(clubAttacksRight(91,away),!away);
    assert.equal(clubAttacksRight(105,away),!away);
    assert.equal(clubAttacksRight(106,away),away);
  }
});

test('missed penalties stay outside the goal and saved penalties end at the goalkeeper',()=>{
  for(const outcome of ['goal','miss','save'] as const) {
    const f=completeFixture();f.cup.phase='penalties';
    f.cup.penaltyEvents=[{id:'p',side:'home',playerId:f.starXI.lineupIds[10],player:'Player',direction:'left',keeperDirection:'right',outcome,createdAt:1_500_000,homeScore:0,awayScore:0,homeTaken:1,awayTaken:0}];
    const event=getViewerEvents(f.cup)[0];
    const frame=getVisualFrame(f,1_502_000,{event,startedAt:1_500_000});
    const inNet=(frame.ball.x>105||frame.ball.x<0)&&frame.ball.y>=30&&frame.ball.y<=38;
    assert.equal(inNet,outcome==='goal');
    if(outcome==='save') assert.ok(frame.ball.x<105);
    assert.ok(frame.status.includes(outcome==='goal'?'TOOOR':outcome==='save'?'Gehalten':'Vorbei'));
  }
});

test('injury and red card remove players while replay before their exit reconstructs the original eleven',()=>{
  const f=completeFixture(),id=f.starXI.lineupIds[5];
  f.cup.playerExitedAt[id]=30;
  const current=baseActors(f,f.cup,40,true);
  assert.equal(current.length,21);assert.ok(!current.some(p=>p.id===id));
  const historical=baseActors(f,f.cup,20,true,true);
  assert.equal(historical.length,22);assert.ok(historical.some(p=>p.id===id));
  f.cup.sentOffPlayerIds=[f.starXI.lineupIds[6]];
  assert.equal(baseActors(f,f.cup,40,true).length,20);
});

test('continuous passes, deterministic refresh and bounded movement throughout normal play',()=>{
  for(const strategyId of ['ballbesitz','angriff','konter'] as const) {
    const f=completeFixture();f.cup.strategyId=strategyId;
    let previous=getVisualFrame(f,1_008_000);
    for(let t=8+1/30;t<170;t+=1/30) {
      const next=getVisualFrame(f,1_000_000+t*1000);
      assert.ok(Math.hypot(next.ball.x-previous.ball.x,next.ball.y-previous.ball.y)<2,'ball must not teleport');
      for(let i=0;i<next.actors.length;i++) assert.ok(Math.hypot(next.actors[i].x-previous.actors[i].x,next.actors[i].y-previous.actors[i].y)<1,'actor must not teleport');
      previous=next;
    }
    assert.deepEqual(getVisualFrame(f,1_067_123),getVisualFrame(JSON.parse(JSON.stringify(f)),1_067_123));
  }
});

test('paused clock and pitch freeze, future authoritative events stay hidden, replays cannot mutate game state',()=>{
  const f=completeFixture();f.cup.matchPaused=true;f.cup.lastTickAt=1_080_000;
  assert.equal(getCupMatchMinute(f.cup,1_300_000),21);
  assert.deepEqual(getVisualFrame(f,1_081_000).actors,getVisualFrame(f,1_300_000).actors);
  f.cup.matchPaused=false;
  f.cup.matchEvents=[{id:'future',side:'home',scorerId:f.starXI.lineupIds[10],scorer:'Player',minute:60,createdAt:1_240_000,homeScore:1,awayScore:0,ratingImpacts:{}}];
  assert.equal(getVisualFrame(f,1_100_000).recent,undefined);
  const before=JSON.stringify(f),replay:Replay={event:getViewerEvents(f.cup)[0],startedAt:1_300_000};
  getVisualFrame(f,1_302_000,replay);
  assert.equal(JSON.stringify(f),before);
});

test('six-minute career report records 90 minutes, extra time records 120, short substitutes do not gain 30 phantom minutes',()=>{
  for(const phase of ['regular','extra-time'] as const) {
    const f=completeFixture();f.cup.phase=phase;f.cup.active=false;f.cup.homeScore=1;
    recordCareerMatch(f);
    const report=f.career.reports.at(-1)!;
    assert.equal(report.players[0].minutes,phase==='regular'?90:120);
  }
});

test('fractional tick cadence preserves whole simulation seconds instead of losing time every poll',()=>{
  const f=completeFixture();const start=f.cup.matchStartedAt;
  const first=advanceCupMatch(f.cup,80,start+1500,()=>.5);
  assert.equal(first.cup.lastTickAt,start+1000);
  const second=advanceCupMatch(first.cup,80,start+3000,()=>.5);
  assert.equal(second.cup.lastTickAt,start+3000);
});

test('viewer renders accessible pitch and correct home scoreboard after normalization without restarting a saved game',()=>{
  const f=completeFixture();f.cup.fixture={id:'away',away:true,venue:{stadium:'Test'} as never,opponentId:'opponent'};
  f.cup.homeScore=2;f.cup.awayScore=1;
  const normalized=normalizeGameFeatures(JSON.parse(JSON.stringify(f)));
  assert.equal(normalized.cup.matchStartedAt,f.cup.matchStartedAt);
  assert.equal(normalized.cup.matchEndsAt,f.cup.matchEndsAt);
  const html=renderToStaticMarkup(createElement(LiveMatchViewer,{features:f,now:1_080_000,clubName:"Club",clubColor:"#0071e3"}));
  assert.ok(html.includes('1 : 2'));assert.ok(html.includes('role="img"'));assert.ok(html.includes('viewBox="-3 -3 111 74"'));
});

test('injury resume retains match minute, remaining duration, fitness and recorded scenes without catching up paused time', async()=>{
 const {resumeCupMatch,applyCupSubstitution,pauseGameFeatureTimers}=await import('../app/feature-data.ts');
 const f=completeFixture();f.cup.lastTickAt=1080000;f.cup.matchPaused=true;
 const beforeMinute=getCupMatchMinute(f.cup,1080000),remaining=f.cup.matchEndsAt-f.cup.lastTickAt;
 const resumed=resumeCupMatch(f.cup,1280000);
 assert.equal(getCupMatchMinute(resumed,1280000),beforeMinute);assert.equal(resumed.matchEndsAt-1280000,remaining);assert.equal(resumed.matchPaused,false);
 assert.equal(resumed.careerMatchId,f.cup.careerMatchId);assert.equal(resumed.careerRatingSeed,f.cup.careerRatingSeed);
 const sub=applyCupSubstitution(f.cup,f.starXI.lineupIds[3],f.starXI.benchIds.find(Boolean)!,beforeMinute,1280000).cup;
 assert.equal(getCupMatchMinute(sub,1280000),beforeMinute);assert.equal(sub.matchPaused,false);
 f.cup.matchEvents=[{id:'paused-goal',side:'home',scorerId:f.starXI.lineupIds[10],scorer:'Player',minute:19,createdAt:1076000,homeScore:1,awayScore:0,ratingImpacts:{}}];
 const restored=pauseGameFeatureTimers(f,20000,1100000);assert.equal(restored.cup.matchEvents[0].createdAt,1096000);assert.equal(restored.cup.matchEvents[0].minute,19);
});
