import { getStarXIPlayer } from './feature-data';
import type { CupGoalEvent } from './feature-data';
// Legacy saves recorded assists as positive rating contributions.
export function goalAssistId(goal:CupGoalEvent) {
 if(goal.pattern==='penalty'||goal.pattern==='rebound')return undefined;
 if(goal.assistId!==undefined)return goal.assistId??undefined;
 return Object.keys(goal.ratingImpacts).find(id=>id!==goal.scorerId&&goal.ratingImpacts[id]>0);
}
export function goalLabel(goal:CupGoalEvent,includeMinute=true) {
 const id=goalAssistId(goal),assist=id?(goal.assistName??getStarXIPlayer(id)?.name):undefined;
 return `${goal.scorer}${includeMinute?` ${goal.minute}′`:''}${goal.pattern==='penalty'?' (P)':''}${assist?` (${assist})`:''}`;
}
