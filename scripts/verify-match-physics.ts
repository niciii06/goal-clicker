import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { verifyFullMatchPhysics } from './qa/match-physics-audit';
mkdirSync('outputs/match-physics',{recursive:true});
const trace=createWriteStream('outputs/match-physics/frames.csv');
trace.write('match,timestamp_ms,x_m,y_m,stoppage\n');
const results=verifyFullMatchPhysics((name,sample)=>trace.write(`${name},${sample.at},${sample.ball.x},${sample.ball.y},${sample.stoppage??''}\n`));
trace.end();
writeFileSync('outputs/match-physics/summary.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
