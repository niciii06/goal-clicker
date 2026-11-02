// TEMPORARY recovery bridge: one time codes the owner issues for exactly one account (scripts/migration/
// issue-recovery-code.mts). 20 characters from 31 unambiguous ones (about 99 bits), shown as five groups of four.
import { createHash, randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ2345679";

export function newRecoveryCode() {
  const chars = Array.from({ length: 20 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return chars.join("").match(/.{4}/g)!.join("-");
}

/** Only this hash is stored. Spaces, dashes and lower case do not matter when the player types the code. */
export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(code.replace(/[\s-]/g, "").toUpperCase()).digest("hex");
}
