// Prints the seed consistency checks. Exits non zero if any fail.
import { buildSeed } from '../src/data/seed';
import { SAMPLE_SIGNALS } from '../src/data/samples';
import { checkSeed } from '../src/data/checkSeed';

const results = checkSeed(buildSeed(), SAMPLE_SIGNALS);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n      ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
