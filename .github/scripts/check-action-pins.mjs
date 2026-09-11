import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const workflowDir = '.github/workflows';
const files = (await readdir(workflowDir))
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .sort();

const violations = [];

for (const file of files) {
  const content = await readFile(path.join(workflowDir, file), 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const match = line.match(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/);
    if (!match) return;

    const target = match[1];
    if (target.startsWith('./') || target.startsWith('docker://')) return;

    const at = target.lastIndexOf('@');
    const action = at === -1 ? target : target.slice(0, at);
    const ref = at === -1 ? '' : target.slice(at + 1);

    if (!/^[0-9a-f]{40}$/i.test(ref)) {
      violations.push(`${file}:${index + 1} ${action} is not pinned to a 40-character commit SHA`);
    }
  });
}

if (violations.length > 0) {
  console.error('Mutable GitHub Action references detected:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Checked ${files.length} workflow(s): all external Actions are pinned to immutable SHAs.`);
