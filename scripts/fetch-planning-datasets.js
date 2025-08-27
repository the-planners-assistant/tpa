#!/usr/bin/env node
/**
 * Fetch snapshot of planning.data.gov.uk datasets for static hosting fallback.
 */
import fs from 'fs';
import path from 'path';

async function main() {
  const url = 'https://www.planning.data.gov.uk/dataset.json';
  console.log('[snapshot] Fetching', url);
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  const outDir = path.join(process.cwd(), 'apps', 'web', 'public', 'planning-data');
  await fs.promises.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'dataset.snapshot.json');
  await fs.promises.writeFile(outFile, JSON.stringify(data, null, 2));
  console.log('[snapshot] Wrote', outFile, `(${Array.isArray(data)?data.length:'?'} records)`);
}

main().catch(err => {
  console.error('[snapshot] Failed:', err);
  process.exit(1);
});
