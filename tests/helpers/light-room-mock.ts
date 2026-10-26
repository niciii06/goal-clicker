// The API tests mock getRoom and updateRoom on a memory row. The slim queries (light row with the md5 of
// the features, seat-only presence writes) are derived from those mocks, so every test exercises them too.
import { createHash } from 'node:crypto';
import type { GoalClickerDatabase, LightRoomRow, RoomRow, RoomSeats } from '../../db/index.ts';

const SEATS = ['host', 'guest', 'player3', 'player4'].flatMap((role) => [`${role}PlayerId`, `${role}Name`, `${role}LastSeenAt`]) as (keyof RoomSeats)[];

export function lightRow(row: RoomRow): LightRoomRow {
  const copy: Partial<RoomRow> = { ...row };
  delete copy.sharedFeaturesJson;
  delete copy.sharedStateBackupJson;
  return { ...(copy as Omit<RoomRow, 'sharedFeaturesJson' | 'sharedStateBackupJson'>), featuresKey: createHash('md5').update(row.sharedFeaturesJson ?? '', 'utf8').digest('hex') };
}

/** Counts how often the full features left the database, to check that polls stay slim. */
export const featureReads = { count: 0 };

export function installLightRoomMocks(Database: typeof GoalClickerDatabase) {
  const proto = Database.prototype;
  const getRoom = proto.getRoom, updateRoom = proto.updateRoom, applyClick = proto.applyClick;
  proto.getRoom = async function (code) { const row = await getRoom.call(this, code); if (row) featureReads.count++; return row; };
  proto.getLightRoom = async function (code) { const row = await getRoom.call(this, code); return row ? lightRow(row) : null; };
  proto.touchRoom = async function (code, values) {
    const row = await updateRoom.call(this, code, values);
    return row ? Object.fromEntries(SEATS.map((key) => [key, row[key]])) as RoomSeats : null;
  };
  proto.applyClick = async function (...args) { const row = await applyClick.call(this, ...args) as unknown as RoomRow | null; return row ? lightRow(row) : null; };
}
