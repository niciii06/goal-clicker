import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("restored VAR and special events are presented as a full takeover", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const restoreBlock = pageSource.slice(
    pageSource.indexOf("const next: GameState"),
    pageSource.indexOf("}, []);", pageSource.indexOf("const next: GameState")),
  );

  assert.match(restoreBlock, /setGame\(next\)/);
  assert.match(restoreBlock, /next\.features\.randomEvent/);
  assert.match(restoreBlock, /presentEventAnnouncement\(next\.features\.randomEvent\)/);
});

test("restored cooperative events are not cleared after presentation", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const resetStart = pageSource.indexOf("useEffect(() => {\n    coopEventRef.current = null;");
  const resetEnd = pageSource.indexOf("\n  }, [activeCoopCode]);", resetStart);
  const resetBlock = pageSource.slice(resetStart, resetEnd);
  const sharedStart = pageSource.indexOf("useEffect(() => {\n    if (!isCoopLive || !sharedRandomEvent", resetEnd);
  const sharedBlock = pageSource.slice(sharedStart, pageSource.indexOf("\n  }, [isCoopLive, sharedRandomEvent]);", sharedStart));

  assert.notEqual(resetStart, -1);
  assert.notEqual(sharedStart, -1);
  assert.match(resetBlock, /setEventAnnouncement\(null\)/);
  assert.match(resetBlock, /if \(!eventAnnouncementRef\.current\)/);
  assert.match(sharedBlock, /presentEventAnnouncement\(sharedRandomEvent\)/);
});
