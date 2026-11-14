#!/usr/bin/env bash
# Disposable local PostgreSQL cluster for the restore, PITR and migration rehearsals (docs/db-rehearsal.md).
# Never touches Neon or any remote database: it only starts a server on 127.0.0.1 in its own directory.
#
#   scripts/db-rehearsal/local-cluster.sh start     # prints the TEST_DATABASE_URL to use
#   scripts/db-rehearsal/local-cluster.sh pitr      # point in time recovery rehearsal on a second throwaway cluster
#   scripts/db-rehearsal/local-cluster.sh stop      # stops the server and deletes the directory
#
# Settings: REHEARSAL_DIR (default /var/tmp/gc-db-rehearsal), REHEARSAL_PORT (default 55432), PG_BIN (default:
# the newest /usr/lib/postgresql/*/bin). As root the server runs as the postgres system user (initdb refuses root).
set -euo pipefail

DIR="${REHEARSAL_DIR:-/var/tmp/gc-db-rehearsal}"
PORT="${REHEARSAL_PORT:-55432}"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
URL="postgres://tester@127.0.0.1:${PORT}/postgres"

case "$DIR" in /|/home|/home/*/|/var|/var/tmp|/tmp) echo "REHEARSAL_DIR=$DIR is too broad" >&2; exit 1;; esac

as_owner() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }

init_cluster() { # <data dir> <port> <wal archive dir>
  local data="$1" port="$2" wal="$3"
  mkdir -p "$data" "$wal"
  [ "$(id -u)" = 0 ] && chown -R postgres "$DIR"
  as_owner "'$PG_BIN/initdb' -D '$data' -U tester --auth=trust -E UTF8 >/dev/null"
  cat >> "$data/postgresql.conf" <<EOF
port = $port
listen_addresses = '127.0.0.1'
unix_socket_directories = '$DIR'
wal_level = replica
archive_mode = on
archive_command = 'test ! -f $wal/%f && cp %p $wal/%f'
archive_timeout = 0
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
EOF
}

start_cluster() { # <data dir>
  as_owner "'$PG_BIN/pg_ctl' -D '$1' -l '$1/server.log' -w start >/dev/null"
}

stop_cluster() { # <data dir>
  [ -f "$1/postmaster.pid" ] && as_owner "'$PG_BIN/pg_ctl' -D '$1' -m fast -w stop >/dev/null" || true
}

q() { psql -X -q -At -v ON_ERROR_STOP=1 "$@"; }

checksums() { # <url>
  q -d "$1" -c "select string_agg(t || ' ' || n || ' ' || h, E'\n' order by t) from (
    select 'cloud_saves' t, count(*) n, md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by user_id), '')) h from cloud_saves x
    union all select 'coop_rooms', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by code), '')) from coop_rooms x
    union all select 'player_accounts', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by user_id), '')) from player_accounts x
    union all select 'profiles', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by user_id), '')) from profiles x
    union all select 'solo_travel', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by owner, fixture_id), '')) from solo_travel x) s"
}

case "${1:-}" in
  start)
    if [ -f "$DIR/main/postmaster.pid" ]; then echo "$URL"; exit 0; fi
    init_cluster "$DIR/main" "$PORT" "$DIR/main-wal"
    start_cluster "$DIR/main"
    echo "$URL"
    ;;
  stop)
    stop_cluster "$DIR/main"; stop_cluster "$DIR/pitr-source"; stop_cluster "$DIR/pitr-restored"
    rm -rf "$DIR"
    ;;
  pitr)
    # Local stand in for Neon's point in time restore: base backup + archived WAL, replayed to a target time.
    # Synthetic data only. It shows the recovery mechanics and that the target point is exact; it does NOT prove
    # that a Neon branch restore works or how far back Neon's history window reaches on this plan.
    SRC="$DIR/pitr-source"; RST="$DIR/pitr-restored"; WAL="$DIR/pitr-wal"; SPORT=$((PORT + 1)); RPORT=$((PORT + 2))
    stop_cluster "$SRC"; stop_cluster "$RST"; rm -rf "$SRC" "$RST" "$WAL" "$DIR/pitr-base"
    init_cluster "$SRC" "$SPORT" "$WAL"
    start_cluster "$SRC"
    SURL="postgres://tester@127.0.0.1:${SPORT}/postgres"
    (cd "$ROOT" && node --input-type=module -e "
      import postgres from 'postgres'; import { drizzle } from 'drizzle-orm/postgres-js'; import { migrate } from 'drizzle-orm/postgres-js/migrator';
      const s = postgres('$SURL', { max: 1, onnotice: () => {} }); await migrate(drizzle(s), { migrationsFolder: 'drizzle' }); await s.end();")
    q -d "$SURL" -c 'set client_min_messages = warning' -f "$ROOT/drizzle/0009_coop_features_key_solo_travel_created_at.sql"
    # Version 1 of six accounts, then the base backup.
    q -d "$SURL" -c "insert into player_accounts (user_id, player_id) select ('00000000-0000-4000-8000-00000000000' || i)::uuid, 'player-' || i from generate_series(1, 6) i;
      insert into profiles (user_id, username, username_key, display_name, username_changed_at, updated_at) select ('00000000-0000-4000-8000-00000000000' || i)::uuid, 'fixture' || i, 'fixture' || i, 'Fixture ' || i, '2026-11-12T09:00:00.000Z', '2026-11-12T09:00:00.000Z' from generate_series(1, 6) i;
      insert into cloud_saves (user_id, save_json, version, active, active_version, updated_at) select ('00000000-0000-4000-8000-00000000000' || i)::uuid, json_build_object('goals', 100 * i, 'album', json_build_object('card-1', i), 'prestige', 0)::text, 1, true, 1, '2026-11-12T09:00:00.000Z' from generate_series(1, 6) i;
      insert into coop_rooms (code, host_player_id, host_name, shared_coins, shared_state_version, shared_features_json) values ('PITR', 'player-1', 'Fixture 1', 1.5e15, 7, '{\"bank\": 99}');
      insert into solo_travel (owner, fixture_id, journey_json) values ('player-1', 'fixture-1', '{\"leg\": 1}');"
    as_owner "'$PG_BIN/pg_basebackup' -h 127.0.0.1 -p $SPORT -U tester -D '$DIR/pitr-base' -X stream -c fast"
    # Play after the backup: version 2 everywhere. This is the state the restore has to bring back.
    q -d "$SURL" -c "update cloud_saves set save_json = json_build_object('goals', 200 * substr(user_id::text, 36)::int, 'album', json_build_object('card-1', 9), 'prestige', 1)::text, version = 2, active_version = 2, updated_at = '2026-11-12T09:30:00.000Z';
      update coop_rooms set shared_state_version = 8, shared_coins = 2e15;"
    EXPECTED="$(checksums "$SURL")"
    sleep 1.1
    TARGET="$(q -d "$SURL" -c "select to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'")"
    sleep 1.1
    # The incident: a bad deploy wipes the saves and a world.
    q -d "$SURL" -c "delete from cloud_saves; delete from coop_rooms; update profiles set display_name = 'kaputt';"
    q -d "$SURL" -c "select pg_switch_wal();" >/dev/null
    sleep 2
    stop_cluster "$SRC"
    # Recovery into a NEW cluster (the source stays as it is, like restoring to a new Neon branch).
    as_owner "cp -a '$DIR/pitr-base' '$RST'"
    sed -i "s/^port = .*/port = $RPORT/; s/^archive_mode = on/archive_mode = off/" "$RST/postgresql.conf"
    cat >> "$RST/postgresql.conf" <<EOF
restore_command = 'cp $WAL/%f %p'
recovery_target_time = '$TARGET'
recovery_target_action = 'promote'
EOF
    as_owner "touch '$RST/recovery.signal'"
    start_cluster "$RST"
    RURL="postgres://tester@127.0.0.1:${RPORT}/postgres"
    for _ in $(seq 1 30); do [ "$(q -d "$RURL" -c 'select pg_is_in_recovery()')" = f ] && break; sleep 1; done
    ACTUAL="$(checksums "$RURL")"
    echo "Ziel Zeitpunkt: $TARGET"
    echo "Erwartet (vor dem Vorfall):"; echo "$EXPECTED"
    echo "Wiederhergestellt:"; echo "$ACTUAL"
    PROFILES_BROKEN="$(q -d "$RURL" -c "select count(*) from profiles where display_name = 'kaputt'")"
    stop_cluster "$RST"
    if [ "$EXPECTED" = "$ACTUAL" ] && [ "$PROFILES_BROKEN" = 0 ]; then echo "PITR OK: Stand vor dem Vorfall exakt wiederhergestellt"; else echo "PITR FEHLER" >&2; exit 1; fi
    ;;
  *) sed -n 2,12p "$0"; exit 1;;
esac
