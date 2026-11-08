import { loadConfig } from '../config';
import { createPool } from '../db';
import { registerSources } from '../sources';

const pool = createPool(loadConfig().DATABASE_URL, 2);
console.log('created:', await registerSources(pool));
await pool.end();
