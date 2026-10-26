import { IndependentMatchRenderer } from './match-renderer-core';
import type { RenderSnapshot } from './match-renderer-core';
import { drawMatchFrame } from './match-canvas-drawing';
import type { CupState } from './feature-data';
import { stadiumView } from './stadium-ambience';
type Command={kind:'init';canvas:OffscreenCanvas;snapshot:RenderSnapshot}|{kind:'sync';snapshot:RenderSnapshot}|{kind:'visibility';visible:boolean}|{kind:'select';x:number;y:number};
const scope=globalThis as unknown as {onmessage:((event:MessageEvent<Command>)=>void)|null;postMessage:(message:unknown)=>void};
const renderer=new IndependentMatchRenderer();let canvas:OffscreenCanvas|undefined,ctx:OffscreenCanvasRenderingContext2D|null=null,timer:ReturnType<typeof setTimeout>|undefined,visible=true,ready=false,lastClock=0;
function render(){
 timer=undefined;if(!visible||!canvas||!ctx||!renderer.snapshot)return;
 const data=renderer.snapshot,frame=renderer.frame(performance.timeOrigin+performance.now());
 if(frame){
  if(canvas.width!==data.width||canvas.height!==data.height){canvas.width=data.width;canvas.height=data.height;}
  const view=stadiumView(data.ambience?.stadium),scale=Math.min(canvas.width/view.width,canvas.height/view.height);ctx.setTransform(scale,0,0,scale,canvas.width/2-view.centerX*scale,canvas.height/2-view.centerY*scale);
  const cup={broadcast:{events:data.yellowCards.map(p=>({...p,kind:'yellow'}))}} as unknown as CupState;
  drawMatchFrame(ctx as unknown as CanvasRenderingContext2D,frame,frame.actors,data.colours,cup,{ambience:data.ambience,now:performance.now(),celebration:frame.celebration,animate:!data.reducedMotion});
  if(!ready){ready=true;scope.postMessage({kind:'ready'});}
  const tick=performance.now();if(tick-lastClock>=100){lastClock=tick;scope.postMessage({kind:'clock',wall:frame.wallTime});}
 }
 timer=setTimeout(render,data.reducedMotion?1000:1000/30);
}
function start(){if(timer!==undefined)clearTimeout(timer);render();}
scope.onmessage=event=>{
 const message=event.data;
 if(message.kind==='init'){canvas=message.canvas;ctx=canvas.getContext('2d');if(!ctx)throw Error('Worker canvas context unavailable');renderer.sync(message.snapshot);start();}
 else if(message.kind==='sync'){renderer.sync(message.snapshot);}
 else if(message.kind==='visibility'){visible=message.visible;if(visible){renderer.reset();start();}else if(timer!==undefined){clearTimeout(timer);timer=undefined;}}
 else if(message.kind==='select'){const frame=renderer.frame(performance.timeOrigin+performance.now()),actor=frame?.actors.find(p=>Math.hypot(p.x-message.x,p.y-message.y)<3.2);if(actor)scope.postMessage({kind:'select',id:actor.id});}
};
