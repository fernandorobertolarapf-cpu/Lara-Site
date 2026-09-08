import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const binaryExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz',
  '.woff', '.woff2', '.ttf', '.otf', '.p12', '.pfx', '.der',
]);

const envTemplateNames = new Set(['.env.example', '.env.sample', '.env.template']);
const findings = [];

const tokenPatterns = [
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{20,}/g],
  ['OpenAI API key', /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{20,}/g],
  ['AWS access key', /AKIA[0-9A-Z]{16}/g],
  ['Slack token', /xox[baprs]-[A-Za-z0-9-]{20,}/g],
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
];

for (const file of tracked) {
  const name = basename(file);

  if (name.startsWith('.env') && !envTemplateNames.has(name)) {
    findings.push(`${file}: arquivo de ambiente não deve ser versionado em site público`);
    continue;
  }

  if (binaryExtensions.has(extname(file).toLowerCase())) continue;

  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const [label, pattern] of tokenPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) findings.push(`${file}: ${label}`);
  }
}

if (findings.length > 0) {
  console.error('Conteúdo potencialmente sensível detectado:');
  for (const finding of findings) console.error(`- ${finding}`);
  console.error('Os valores suspeitos não são exibidos por este checker.');
  process.exit(1);
}

console.log(`Public-site security check: OK (${tracked.length} arquivos rastreados).`);
