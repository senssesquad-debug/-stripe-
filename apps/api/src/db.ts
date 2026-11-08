import pg from 'pg';

// Return dates as JS Date, bigint counts as numbers (safe for our ranges), DATE columns as 'YYYY-MM-DD' strings.
pg.types.setTypeParser(20, (v) => Number(v)); // int8
pg.types.setTypeParser(1700, (v) => Number(v)); // numeric
pg.types.setTypeParser(1082, (v) => v); // date

export type Db = pg.Pool;
export type Queryable = Pick<pg.Pool, 'query'> | pg.PoolClient;

export function createPool(url: string, max = 10): pg.Pool {
  const pool = new pg.Pool({ connectionString: url, max, idleTimeoutMillis: 30_000, application_name: 'passtra' });
  pool.on('error', (err) => {
    // Idle client errors must not crash the process.
    console.error('[db] idle client error', err.message);
  });
  return pool;
}

export async function tx<T>(pool: pg.Pool, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

export async function one<T extends pg.QueryResultRow>(db: Queryable, sql: string, params: unknown[] = []): Promise<T | null> {
  const r = await db.query<T>(sql, params);
  return r.rows[0] ?? null;
}

export async function many<T extends pg.QueryResultRow>(db: Queryable, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

/** SQL expression building a geography point from $lng/$lat parameters. */
export const point = (lngParam: string, latParam: string) => `ST_SetSRID(ST_MakePoint(${lngParam}, ${latParam}), 4326)::geography`;
