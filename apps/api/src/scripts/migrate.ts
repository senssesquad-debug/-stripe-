import { loadConfig } from '../config';
import { createPool } from '../db';
import { migrate } from '../migrate';
import { registerSources } from '../sources';

const config = loadConfig();
const pool = createPool(config.DATABASE_URL, 2);
const applied = await migrate(pool, (m) => console.log(m));
const created = await registerSources(pool);
console.log(`migrations applied: ${applied.length ? applied.join(', ') : 'none'}; sources created: ${created.length ? created.join(', ') : 'none'}`);
await pool.end();
