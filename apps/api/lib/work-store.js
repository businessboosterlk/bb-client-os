/* Which workspace store this copy of the API runs on: the database with the service key, else memory (the demo and every
   test). Both answer the same contract (mould/stage2/parts/COMMON-SERVER.md). */
import * as memory from './work-memory.js';
import * as db from './work-db.js';
import { mode } from './store.js';
export const work = mode === 'supabase' ? db : memory;
