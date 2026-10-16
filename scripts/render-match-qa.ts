// Standalone renderer uses the production pitch and frame drawing functions.
// Run with node --import tsx scripts/render-match-qa.ts; outputs are temporary QA artifacts.
import {createRequire} from 'node:module';
const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');
import {mkdirSync,writeFileSync} from 'node:fs';
import {initialGameFeatures,STAR_XI_PLAYERS,setBestStarXI,beginSeasonCupMatch,getStarXISelection} from '../app/feature-data';
import {createMatchBroadcast} from '../app/match-broadcast';
import {getViewerEvents} from '../app/match-visual-frame';
import {drawMatchFrame,MatchPresentation} from '../app/match-pitch-canvas';
import type {BroadcastEvent} from '../app/match-broadcast';
const f=initialGameFeatures(1000000);f.starXI=setBestStarXI({...f.starXI,ownedIds:STAR_XI_PLAYERS.map(p=>p.id)});f.cup=beginSeasonCupMatch(f.cup,f.seasonMode,1000000,getStarXISelection(f.starXI.ownedIds,f.starXI.lineupIds),f.starXI.formationPositions,f.starXI.lineupIds,f.starXI.benchIds);f.cup.broadcast=createMatchBroadcast(f.cup);
mkdirSync('outputs/match-qa',{recursive:true});
const scenarios=['Spielaufbau','Ecke · Kopfball','Freistoss · Parade','Distanzschuss · vorbei'];
const contact=createCanvas(1200,900),contactCtx=contact.getContext('2d');contactCtx.fillStyle='#0b1e19';contactCtx.fillRect(0,0,1200,900);
for(let scenario=0;scenario<scenarios.length;scenario++){
 const e:BroadcastEvent={id:`qa-${scenario}`,kind:scenario===1?'corner':scenario===2?'free-kick':scenario===3?'shot':'build-up',side:'club',at:1030000,minute:8,playerId:f.starXI.lineupIds[10],player:'Player',style:scenario===1?'header':'long-range',outcome:scenario===3?'wide':'save',lane:31,seed:.3};
 f.cup.broadcast.events=scenario===0?[]:[e];
 const event=getViewerEvents(f.cup)[0],motion=new MatchPresentation();let picked:ReturnType<typeof createCanvas>|undefined;
 for(let index=0;index<120;index++){
  const wall=1030000+index/30*1000,{frame,actors,ball}=motion.step(f,wall,1/30,event?{event,startedAt:1030000}:undefined);
  const canvas=createCanvas(960,672),ctx=canvas.getContext('2d');ctx.fillStyle='#0b1e19';ctx.fillRect(0,0,960,672);ctx.setTransform(8.45,0,0,8.45,36,40);drawMatchFrame(ctx as unknown as CanvasRenderingContext2D,frame,actors,{club:'#0071e3',opponent:'#ffc857'},f.cup,ball);ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='white';ctx.font='bold 18px sans-serif';ctx.textAlign='left';ctx.fillText(`${scenarios[scenario]} · ${frame.status}`,20,24);
  if(index===110)picked=canvas;
  writeFileSync(`outputs/match-qa/frame-${String(scenario*120+index).padStart(4,'0')}.png`,canvas.toBuffer('image/png'));
 }
 contactCtx.drawImage(picked!,scenario%2*600,Math.floor(scenario/2)*450,600,420);contactCtx.fillStyle='white';contactCtx.font='bold 19px sans-serif';contactCtx.fillText(scenarios[scenario],scenario%2*600+18,Math.floor(scenario/2)*450+441);
}
writeFileSync('outputs/match-qa/contact.png',contact.toBuffer('image/png'));
console.log('Rendered 480 production animation frames and contact sheet.');
