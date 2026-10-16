import type { Actor } from './match-viewer';
import type { GameFeatures } from './feature-data';
import type { getVisualFrame } from './match-viewer';
import { drawAtmosphere, drawCelebration, drawStands, drawWeather } from './stadium-ambience';
import type { Ambience } from './stadium-ambience';
import type { FrameCelebration } from './interactive-frame-data';

export type StadiumExtras={ambience?:Ambience;now?:number;celebration?:FrameCelebration;animate?:boolean};

export function drawFootballPitch(ctx:CanvasRenderingContext2D) {
 ctx.fillStyle='#16432e';ctx.fillRect(-4,-4,113,76);
 for(let i=0;i<14;i++){ctx.fillStyle=i%2?'#287f4c':'#237648';ctx.fillRect(i*7.5,0,7.5,68);}
 ctx.strokeStyle='#d5eddb';ctx.lineWidth=.32;ctx.strokeRect(0,0,105,68);
 ctx.beginPath();ctx.moveTo(52.5,0);ctx.lineTo(52.5,68);ctx.stroke();
 const circle=(x:number,y:number,r:number)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();};circle(52.5,34,9.15);
 for(const x of [0,105]){
  ctx.strokeRect(x===0?0:88.5,13.84,16.5,40.32);ctx.strokeRect(x===0?0:99.5,24.84,5.5,18.32);
  circle(x===0?11:94,34,.35);ctx.beginPath();ctx.arc(x===0?11:94,34,9.15,x===0?-.92:Math.PI-.92,x===0?.92:Math.PI+.92);ctx.stroke();
  ctx.strokeStyle='#f4fbf5';ctx.lineWidth=.45;ctx.strokeRect(x===0?-2:105,30.34,2,7.32);ctx.lineWidth=.32;ctx.strokeStyle='#d5eddb';
  for(let net=.5;net<2;net+=.5){ctx.beginPath();ctx.moveTo(x===0?-net:105+net,30.34);ctx.lineTo(x===0?-net:105+net,37.66);ctx.stroke();}
 }
 for(const [x,y,start] of [[0,0,0],[105,0,Math.PI/2],[105,68,Math.PI],[0,68,Math.PI*1.5]]){ctx.beginPath();ctx.arc(x,y,1,start,start+Math.PI/2);ctx.stroke();}
 ctx.fillStyle='#d5eddb';ctx.beginPath();ctx.arc(52.5,34,.38,0,Math.PI*2);ctx.fill();
}
export function drawMatchFrame(ctx:CanvasRenderingContext2D,frame:ReturnType<typeof getVisualFrame>,actors:Actor[],colours:{club:string;opponent:string},cup:GameFeatures['cup'],extras:StadiumExtras={}) {
 const now=extras.now??0,animate=extras.animate!==false;
 if(extras.ambience)drawStands(ctx,extras.ambience,colours,now,extras.celebration,animate);
 drawFootballPitch(ctx);
 if(extras.ambience)drawAtmosphere(ctx,extras.ambience);
   for(const p of actors){
    const keeper=p.goalkeeper;ctx.fillStyle=keeper?p.team==='club'?'#c684f4':'#74d0ed':colours[p.team];ctx.strokeStyle='#effff3';ctx.lineWidth=.35;
    ctx.beginPath();ctx.ellipse(p.x,p.y,frame.keeperDive===p.id?2.65:1.65,frame.keeperDive===p.id?.9:1.65,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.font='bold 1.9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=.18;ctx.strokeStyle='#071b12';ctx.strokeText(p.shirt,p.x,p.y+.08);ctx.fillStyle='white';ctx.fillText(p.shirt,p.x,p.y+.08);
    if(cup.broadcast?.events.some(e=>e.kind==='yellow'&&e.playerId===p.id&&e.minute<=frame.minute)){ctx.fillStyle='#ffe449';ctx.fillRect(p.x+1.2,p.y-2.8,.9,1.4);}
   }
   if(frame.ballOwnerId){const p=actors.find(p=>p.id===frame.ballOwnerId);if(p){ctx.strokeStyle='#ffffff';ctx.lineWidth=.35;ctx.beginPath();ctx.arc(p.x,p.y,2.3,0,Math.PI*2);ctx.stroke();}}
   let ball={...frame.ball};
   if(frame.ballOwnerId&&!frame.pass&&!frame.shotFlight){const owner=actors.find(p=>p.id===frame.ballOwnerId),ideal=frame.actors.find(p=>p.id===frame.ballOwnerId);if(owner&&ideal){ball.x+=owner.x-ideal.x;ball.y+=owner.y-ideal.y;}}
   if(frame.pass){const a=actors.find(p=>p.id===frame.pass!.fromId),b=actors.find(p=>p.id===frame.pass!.toId);if(a&&b)ball={x:a.x+(b.x-a.x)*frame.pass.progress,y:a.y+(b.y-a.y)*frame.pass.progress};}
   if(frame.shotFlight){const a=actors.find(p=>p.id===frame.shotFlight!.fromId),ideal=frame.actors.find(p=>p.id===frame.shotFlight!.fromId);if(a&&ideal){ball.x+=(a.x-ideal.x)*(1-frame.shotFlight.progress);ball.y+=(a.y-ideal.y)*(1-frame.shotFlight.progress);}}
   ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(ball.x,ball.y+.8,1.1,.5,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#fff';ctx.strokeStyle='#132319';ctx.lineWidth=.23;ctx.beginPath();ctx.arc(ball.x,ball.y-frame.height*.7,.75+frame.height*.06,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#132319';ctx.beginPath();ctx.arc(ball.x-.15,ball.y-frame.height*.7-.12,.19,0,Math.PI*2);ctx.fill();
 if(extras.ambience)drawWeather(ctx,extras.ambience,now,animate);
 if(extras.celebration)drawCelebration(ctx,extras.celebration,actors.find(p=>p.id===extras.celebration!.scorerId)?.label??'',colours,now,animate);
}
