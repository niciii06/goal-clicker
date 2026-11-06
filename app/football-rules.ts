export type PitchPoint={x:number;y:number};
export type RestartKind='open-play'|'throw-in'|'corner'|'goal-kick'|'free-kick'|'kickoff';
export type OffsideSnapshot={releasedAt:number;right:boolean;ball:PitchPoint;receiver:PitchPoint;opponents:PitchPoint[];activelyInvolved:boolean;restart:RestartKind};
/** IFAB Law 11: evaluate the position at the teammate's release, including the goalkeeper. */
export function evaluateOffside(s:OffsideSnapshot){
 if(!s.activelyInvolved||['throw-in','corner','goal-kick'].includes(s.restart))return false;
 const forward=(p:PitchPoint)=>s.right?p.x:105-p.x;
 const receiver=forward(s.receiver),ball=forward(s.ball);
 if(receiver<=52.5||receiver<=ball+.01)return false;
 const defenders=s.opponents.map(forward).sort((a,b)=>b-a);
 const secondLast=defenders[1]??0;
 return receiver>secondLast+.01;
}
export function goalkeeperSaveProbability(attributes:{rating:number;reflexes?:number;positioning?:number;handling?:number;reactions?:number},distance:number,angle:number,finishing:number){
 const skill=((attributes.reflexes??attributes.rating)*.35+(attributes.positioning??attributes.rating)*.3+(attributes.handling??attributes.rating)*.15+(attributes.reactions??attributes.rating)*.2)/100;
 const quality=Math.max(.05,Math.min(.95,(finishing/100)*.5+(1-Math.min(40,distance)/40)*.45-Math.abs(angle)*.12));
 return Math.max(.12,Math.min(.94,.35+skill*.55-quality*.35));
}
export type DecisionPlayer=PitchPoint&{id:string;passing:number;finishing:number;control:number;stamina:number};
export function chooseBallAction(carrier:DecisionPlayer,team:DecisionPlayer[],opponents:PitchPoint[],right:boolean){
 const progress=(p:PitchPoint)=>right?p.x:105-p.x;
 const goalDistance=Math.hypot((right?105:0)-carrier.x,34-carrier.y);
 const angle=Math.abs(carrier.y-34)/Math.max(1,105-progress(carrier));
 const pressure=Math.min(30,...opponents.map(p=>Math.hypot(p.x-carrier.x,p.y-carrier.y)));
 const options=team.filter(p=>p.id!==carrier.id).map(p=>{
  const distance=Math.hypot(p.x-carrier.x,p.y-carrier.y),space=Math.min(20,...opponents.map(o=>Math.hypot(o.x-p.x,o.y-p.y)));
  const betterChance=progress(p)>progress(carrier)+3&&Math.abs(p.y-34)<Math.abs(carrier.y-34)-3;
  return {p,score:space*.7+(progress(p)-progress(carrier))*.35-distance*.13+carrier.passing*.035+(betterChance?10:0)};
 }).sort((a,b)=>b.score-a.score||a.p.id.localeCompare(b.p.id));
 const target=options[0];
 if(goalDistance<24&&angle<1.2&&(!target||target.score<22))return {kind:'shoot' as const,target:undefined};
 if(target&&(pressure<8||target.score>12))return {kind:'pass' as const,target:target.p.id};
 return {kind:pressure<3?'shield' as const:'dribble' as const,target:undefined};
}
export function restartPoint(kind:RestartKind,right:boolean,lane=34):PitchPoint {
 if(kind==='kickoff')return {x:52.5,y:34};
 if(kind==='corner')return {x:right?105:0,y:lane<34?0:68};
 if(kind==='goal-kick')return {x:right?5.5:99.5,y:34};
 if(kind==='throw-in')return {x:right?70:35,y:lane<34?0:68};
 return {x:right?78:27,y:Math.max(8,Math.min(60,lane))};
}
/** Keeping of an outfield player who has to go in goal: whatever his card says, never more than this. */
export const STAND_IN_KEEPING_CAP=35;
/** Goal chance multiplier with nobody in goal at all. */
export const EMPTY_GOAL_FACTOR=1.5;
/** Change of the goal chance per rating point the keeper is better (or worse) than the shooter's level. */
export const KEEPER_SKILL_WEIGHT=.012;
/**
 * How the goalkeeper changes the chance that a shot goes in (multiplies the shot quality). A keeper of the
 * shooter's level gives the same value as the engine always did (1.38 minus rating/280, so the average number of
 * goals stays); every point he is better lowers it, every point worse raises it. The same rule for both sides.
 */
export function keeperGoalFactor(keeperSkill:number|undefined,shooterRating:number){
 if(keeperSkill===undefined||!Number.isFinite(keeperSkill))return EMPTY_GOAL_FACTOR;
 const neutral=1.38-shooterRating/280;
 return Math.max(.7,Math.min(EMPTY_GOAL_FACTOR-.05,neutral+(shooterRating-keeperSkill)*KEEPER_SKILL_WEIGHT));
}
/** Goalkeeping strength: a real keeper plays at his rating, an outfield player in goal at his weak keeping. */
export function keeperSkill(p:{rating:number;keeping:number;standInRole?:string}){
 return p.standInRole?Math.min(p.keeping,STAND_IN_KEEPING_CAP):p.rating;
}
