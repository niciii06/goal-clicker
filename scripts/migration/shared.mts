// Helpers for the one off migration scripts. Connection strings come only from environment variables and are
// never printed; output names hosts at most.
import postgres from 'postgres';

export function connect(name: string, { readOnly = false } = {}) {
  const url = process.env[name];
  if (!url) {
    console.error(`${name} ist nicht gesetzt.`);
    process.exit(2);
  }
  let host = '?';
  try { host = new URL(url).hostname; } catch { /* printed as ? */ }
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {}, connection: readOnly ? { default_transaction_read_only: true } : {} });
  return { sql, host };
}

export const flag = (name: string) => process.argv.includes(name);
export function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? '' : '';
}
