import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const baseline = JSON.parse(
  readFileSync(new URL('../security/public-content-baseline.json', import.meta.url), 'utf8'),
);

const maxUnmasked = Number(baseline.maxUnmaskedPasswordExamples);
if (!Number.isInteger(maxUnmasked) || maxUnmasked < 0) {
  console.error('Baseline inválido: maxUnmaskedPasswordExamples deve ser inteiro >= 0.');
  process.exit(2);
}

const masked = /^(?:\[protegida\]|\[redigida\]|•{4,}|\*{4,}|x{4,})$/iu;
const findings = [];
const passwordPattern = /Senha\s*:\s*([^'"\n<\\},]+)/giu;

for (const match of html.matchAll(passwordPattern)) {
  const value = match[1].trim();
  if (!value || masked.test(value)) continue;

  const prefix = html.slice(0, match.index ?? 0);
  findings.push(prefix.split('\n').length);
}

if (findings.length > maxUnmasked) {
  console.error(
    `Conteúdo público contém ${findings.length} exemplo(s) de senha não mascarada; baseline permite no máximo ${maxUnmasked}.`,
  );
  console.error(`Linhas com achado: ${findings.join(', ')}.`);
  console.error('Os valores não são impressos para evitar transformar a CI em canal de vazamento.');
  process.exit(1);
}

if (findings.length < maxUnmasked) {
  console.log(
    `Melhoria detectada: há ${findings.length} exemplo(s) não mascarado(s), abaixo do baseline ${maxUnmasked}.`,
  );
  console.log('Reduza maxUnmaskedPasswordExamples na mesma PR que mascarar o conteúdo restante.');
} else {
  console.log(`Baseline preservado: ${findings.length}/${maxUnmasked} exemplo(s) não mascarado(s).`);
}
