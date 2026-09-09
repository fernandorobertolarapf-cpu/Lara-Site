import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const findings = [];

const requireMatch = (pattern, message) => {
  if (!pattern.test(html)) findings.push(message);
};

const lineOf = (offset) => html.slice(0, offset ?? 0).split('\n').length;

requireMatch(/<!doctype\s+html>/i, 'index.html: DOCTYPE HTML ausente');
requireMatch(/<html\b[^>]*\blang=["']pt-BR["']/i, 'index.html: lang="pt-BR" ausente');
requireMatch(/<meta\b[^>]*\bcharset=["']?utf-8["']?/i, 'index.html: meta charset UTF-8 ausente');
requireMatch(/<meta\b[^>]*\bname=["']viewport["'][^>]*>/i, 'index.html: meta viewport ausente');
requireMatch(/<title>\s*[^<\s][^<]*<\/title>/i, 'index.html: title vazio ou ausente');

const ids = new Set();
for (const match of html.matchAll(/\bid=["']([^"']+)["']/gi)) {
  const id = match[1];
  if (ids.has(id)) findings.push(`index.html: id duplicado: ${id}`);
  ids.add(id);
}

for (const match of html.matchAll(/\bhref=["']#([^"']*)["']/gi)) {
  const target = match[1];
  if (!target) continue;
  if (!ids.has(target)) findings.push(`index.html: âncora interna sem destino: #${target}`);
}

for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
  const value = match[1];
  const line = lineOf(match.index);
  if (/^http:\/\//i.test(value)) {
    findings.push(`index.html:${line}: recurso/link HTTP inseguro`);
  }
  if (/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|example\.com|trycloudflare\.com)/i.test(value)) {
    findings.push(`index.html:${line}: URL de desenvolvimento/placeholder publicada`);
  }
}

if (findings.length > 0) {
  console.error('Static-site structure check falhou:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Static-site structure check: OK (${ids.size} ids verificados).`);
