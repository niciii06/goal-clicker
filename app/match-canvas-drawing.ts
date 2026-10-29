import type { Actor } from './match-viewer';
import type { GameFeatures } from './feature-data';
import type { getVisualFrame } from './match-viewer';
import { drawAtmosphere, drawCelebration, drawPitchside, drawStands, drawWeather } from './stadium-ambience';
import type { Ambience } from './stadium-ambience';
import type { FrameCelebration } from './interactive-frame-data';

export type StadiumExtras={ambience?:Ambience;now?:number;celebration?:FrameCelebration;animate?:boolean};

const hash=(n:number)=>{let x=n|0;x=Math.imul(x^(x>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/4294967296;};

export function drawFootballPitch(ctx:CanvasRenderingContext2D) {
 ctx.fillStyle='#16432e';ctx.fillRect(-4,-4,113,76);
 // Mown stripes across and a lighter checker along the pitch, like a freshly cut stadium lawn.
 for(let i=0;i<14;i++){ctx.fillStyle=i%2?'#2a8550':'#247a49';ctx.fillRect(i*7.5,0,7.5,68);}
 ctx.fillStyle='rgba(255,255,255,.035)';for(let j=0;j<8;j++)if(j%2)ctx.fillRect(0,j*8.5,105,8.5);
 // Grass texture: tiny lighter and darker tufts, always in the same places.
 for(let i=0;i<900;i++){const x=hash(i*3+1)*105,y=hash(i*7+2)*68,dark=hash(i*11+3)>.5;ctx.fillStyle=dark?'rgba(0,30,10,.08)':'rgba(255,255,220,.06)';ctx.fillRect(x,y,.35,.18);}
 // Worn grass where most of the game happens: in front of both goals, on the penalty spots and at the centre.
 const wear=(x:number,y:number,rx:number,ry:number,alpha:number)=>{ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,`rgba(120,105,60,${alpha})`);g.addColorStop(1,'rgba(120,105,60,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore();};
 for(const x of [3.2,101.8]){wear(x,34,3.4,5.2,.32);wear(x===3.2?11:94,34,1.6,1.6,.25);}
 wear(52.5,34,2.6,2.6,.18);
 // Soft light in the middle, darker towards the touchlines.
 const light=ctx.createRadialGradient(52.5,34,6,52.5,34,70);light.addColorStop(0,'rgba(255,255,240,.07)');light.addColorStop(1,'rgba(0,20,10,.16)');
 ctx.fillStyle=light;ctx.fillRect(0,0,105,68);
 ctx.strokeStyle='rgba(236,250,240,.92)';ctx.lineWidth=.3;ctx.lineCap='round';ctx.strokeRect(0,0,105,68);
 ctx.beginPath();ctx.moveTo(52.5,0);ctx.lineTo(52.5,68);ctx.stroke();
 const circle=(x:number,y:number,r:number)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();};circle(52.5,34,9.15);
 for(const x of [0,105]){
  const left=x===0;
  ctx.strokeRect(left?0:88.5,13.84,16.5,40.32);ctx.strokeRect(left?0:99.5,24.84,5.5,18.32);
  ctx.fillStyle='rgba(236,250,240,.92)';ctx.beginPath();ctx.arc(left?11:94,34,.32,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(left?11:94,34,9.15,left?-.92:Math.PI-.92,left?.92:Math.PI+.92);ctx.stroke();
  // The goal: a net with a mesh and white posts and crossbar, with a little depth.
  const gx=left?-2.2:105,gw=2.2;
  ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(gx,30.34,gw,7.32);
  ctx.strokeStyle='rgba(255,255,255,.38)';ctx.lineWidth=.08;ctx.beginPath();
  for(let y=30.34;y<=37.66;y+=.6){ctx.moveTo(gx,y);ctx.lineTo(gx+gw,y);}
  for(let d=0;d<=gw;d+=.55){ctx.moveTo(gx+d,30.34);ctx.lineTo(gx+d,37.66);}
  ctx.stroke();
  ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(left?-.15:105,30.5,.5,7.32);
  ctx.strokeStyle='#ffffff';ctx.lineWidth=.42;ctx.beginPath();ctx.moveTo(left?0:105,30.34);ctx.lineTo(gx+(left?0:gw),30.34);ctx.lineTo(gx+(left?0:gw),37.66);ctx.lineTo(left?0:105,37.66);ctx.stroke();
  ctx.strokeStyle='rgba(236,250,240,.92)';ctx.lineWidth=.3;
 }
 for(const [x,y,start] of [[0,0,0],[105,0,Math.PI/2],[105,68,Math.PI],[0,68,Math.PI*1.5]]){ctx.beginPath();ctx.arc(x,y,1,start,start+Math.PI/2);ctx.stroke();}
 ctx.fillStyle='rgba(236,250,240,.92)';ctx.beginPath();ctx.arc(52.5,34,.38,0,Math.PI*2);ctx.fill();
}

/** The ball's last positions per canvas, for its trail. */
type Motion={trail:{x:number;y:number}[]};
const motions=new WeakMap<object,Motion>();
function motionOf(ctx:CanvasRenderingContext2D){let m=motions.get(ctx);if(!m){m={trail:[]};motions.set(ctx,m);}return m;}

/** A player: the familiar disc in the kit colour with a white rim and the shirt number, now with a shadow on the grass. */
const SUN_SHADOW:[number,number,number][]=[[.35,.45,.26]];
// Under floodlights every player throws four faint shadows, one away from each corner mast.
const FLOODLIGHT_SHADOWS:[number,number,number][]=[[.55,.55,.1],[-.55,.55,.1],[.55,-.55,.1],[-.55,-.55,.1]];
function drawPlayer(ctx:CanvasRenderingContext2D,p:Actor,kit:string,diving:boolean,owner:boolean,pulse:number,shadows:[number,number,number][]){
 const rx=diving?2.65:1.65,ry=diving?.9:1.65;
 for(const [dx,dy,alpha] of shadows){ctx.fillStyle=`rgba(0,0,0,${alpha})`;ctx.beginPath();ctx.ellipse(p.x+dx,p.y+dy,rx,ry*.92,0,0,Math.PI*2);ctx.fill();}
 if(owner){ctx.strokeStyle=`rgba(255,255,255,${.55+.35*pulse})`;ctx.lineWidth=.32;ctx.beginPath();ctx.arc(p.x,p.y,2.3+.25*pulse,0,Math.PI*2);ctx.stroke();}
 ctx.fillStyle=kit;ctx.strokeStyle='#effff3';ctx.lineWidth=.35;
 ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.font='bold 1.9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=.18;ctx.strokeStyle='#071b12';ctx.strokeText(p.shirt,p.x,p.y+.08);ctx.fillStyle='white';ctx.fillText(p.shirt,p.x,p.y+.08);
}

export function drawMatchFrame(ctx:CanvasRenderingContext2D,frame:ReturnType<typeof getVisualFrame>,actors:Actor[],colours:{club:string;opponent:string},cup:GameFeatures['cup'],extras:StadiumExtras={}) {
 const now=extras.now??0,animate=extras.animate!==false;
 if(extras.ambience)drawStands(ctx,extras.ambience,colours,now,extras.celebration,animate);
 drawFootballPitch(ctx);
 if(extras.ambience){drawPitchside(ctx,extras.ambience);drawAtmosphere(ctx,extras.ambience);}
   const motion=motionOf(ctx),t=now/1000,pulse=animate?(Math.sin(t*5)+1)/2:.5;
   let ball={...frame.ball};
   if(frame.ballOwnerId&&!frame.pass&&!frame.shotFlight){const owner=actors.find(p=>p.id===frame.ballOwnerId),ideal=frame.actors.find(p=>p.id===frame.ballOwnerId);if(owner&&ideal){ball.x+=owner.x-ideal.x;ball.y+=owner.y-ideal.y;}}
   if(frame.pass){const a=actors.find(p=>p.id===frame.pass!.fromId),b=actors.find(p=>p.id===frame.pass!.toId);if(a&&b)ball={x:a.x+(b.x-a.x)*frame.pass.progress,y:a.y+(b.y-a.y)*frame.pass.progress};}
   if(frame.shotFlight){const a=actors.find(p=>p.id===frame.shotFlight!.fromId),ideal=frame.actors.find(p=>p.id===frame.shotFlight!.fromId);if(a&&ideal){ball.x+=(a.x-ideal.x)*(1-frame.shotFlight.progress);ball.y+=(a.y-ideal.y)*(1-frame.shotFlight.progress);}}
   const shadows=extras.ambience&&extras.ambience.time!=='day'?FLOODLIGHT_SHADOWS:SUN_SHADOW;
   for(const p of actors){
    const kit=p.goalkeeper?p.team==='club'?'#c684f4':'#74d0ed':colours[p.team];
    drawPlayer(ctx,p,kit,frame.keeperDive===p.id,frame.ballOwnerId===p.id,pulse,shadows);
    if(cup.broadcast?.events.some(e=>e.kind==='yellow'&&e.playerId===p.id&&e.minute<=frame.minute)){ctx.fillStyle='#ffe449';ctx.fillRect(p.x+1.2,p.y-2.8,.9,1.4);}
   }
   // The name of the player on the ball, like a TV caption under him.
   const owner=frame.ballOwnerId?actors.find(p=>p.id===frame.ballOwnerId):undefined;
   if(owner&&owner.label){const name=owner.caption??owner.label.split(' ').slice(-1)[0];ctx.font='700 1.45px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='top';const w=ctx.measureText(name).width+1;ctx.fillStyle='rgba(6,22,15,.72)';ctx.fillRect(owner.x-w/2,owner.y+2.35,w,1.85);ctx.fillStyle='#f4fff7';ctx.fillText(name,owner.x,owner.y+2.55);}
   // A short trail behind a ball that flies.
   const lift=frame.height*.7,trail=motion.trail;
   const flying=Boolean(frame.pass||frame.shotFlight||frame.height>.2);
   if(flying&&animate){trail.push({x:ball.x,y:ball.y-lift});if(trail.length>7)trail.shift();}else trail.length=0;
   for(let i=1;i<trail.length;i++){ctx.strokeStyle=`rgba(255,255,255,${(i/trail.length)*.35})`;ctx.lineWidth=.5*(i/trail.length);ctx.beginPath();ctx.moveTo(trail[i-1].x,trail[i-1].y);ctx.lineTo(trail[i].x,trail[i].y);ctx.stroke();}
   // Ball: the shadow stays on the grass and spreads as the ball rises.
   ctx.fillStyle=`rgba(0,0,0,${Math.max(.12,.3-frame.height*.03)})`;ctx.beginPath();ctx.ellipse(ball.x+.35+frame.height*.25,ball.y+.6,1+frame.height*.12,.48+frame.height*.06,0,0,Math.PI*2);ctx.fill();
   const br=.75+frame.height*.06,by=ball.y-lift;
   const shine=ctx.createRadialGradient(ball.x-br*.35,by-br*.35,br*.1,ball.x,by,br);shine.addColorStop(0,'#ffffff');shine.addColorStop(1,'#cfd6d2');
   ctx.fillStyle=shine;ctx.strokeStyle='#0f1d16';ctx.lineWidth=.16;ctx.beginPath();ctx.arc(ball.x,by,br,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.fillStyle='#16241c';const spin=animate?t*(flying?9:2):0;
   for(let k=0;k<3;k++){const a=spin+k*2.1;ctx.beginPath();ctx.arc(ball.x+Math.cos(a)*br*.48,by+Math.sin(a)*br*.48,br*.2,0,Math.PI*2);ctx.fill();}
 if(extras.ambience)drawWeather(ctx,extras.ambience,now,animate);
 if(extras.celebration)drawCelebration(ctx,extras.celebration,actors.find(p=>p.id===extras.celebration!.scorerId)?.label??'',colours,now,animate);
}
