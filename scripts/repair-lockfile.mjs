import fs from "node:fs";
import path from "node:path";

const lockfilePath = path.resolve(process.cwd(), "package-lock.json");
const rawContent = fs.readFileSync(lockfilePath, "utf8").trimEnd();

function repairLockfileJson(content) {
  try {
    JSON.parse(content);
    return content + "\n";
  } catch {
    const candidateTwoBraces = `${content}\n  }\n}\n`;
    try {
      JSON.parse(candidateTwoBraces);
      return candidateTwoBraces;
    } catch {
      const candidateOneBrace = `${content}\n}\n`;
      JSON.parse(candidateOneBrace);
      return candidateOneBrace;
    }
  }
}

const repairedContent = repairLockfileJson(rawContent);
const parsed = JSON.parse(repairedContent);

if (parsed.packages && parsed.packages[""] && parsed.packages[""].devDependencies) {
  parsed.packages[""].devDependencies.tsx = "4.22.1";
}

fs.writeFileSync(lockfilePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
