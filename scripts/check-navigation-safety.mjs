import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const findings = [];

const lineOf = (offset) => html.slice(0, offset ?? 0).split('\n').length;
const decodeBasicEntities = (value) => value
  .replaceAll('&colon;', ':')
  .replaceAll('&#58;', ':')
  .replaceAll('&#x3a;', ':')
  .replaceAll('&#X3A;', ':')
  .replaceAll('&Tab;', '\t')
  .replaceAll('&NewLine;', '\n');

const normalizeUrl = (value) => decodeBasicEntities(value)
  .replace(/[\u0000-\u0020\u007f]+/g, '')
  .toLowerCase();

const dangerousScheme = (value) => {
  const normalized = normalizeUrl(value);
  return normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('data:text/html') ||
    normalized.startsWith('data:application/xhtml+xml');
};

// Navegação e submissão: não permitir esquemas executáveis nem HTTP absoluto.
for (const match of html.matchAll(/\b(href|src|action|formaction)\s*=\s*["']([^"']*)["']/gi)) {
  const [, attribute, value] = match;
  const line = lineOf(match.index);

  if (dangerousScheme(value)) {
    findings.push(`index.html:${line}: ${attribute.toLowerCase()} usa esquema de URL executável/perigoso`);
  }

  if (/^(action|formaction)$/i.test(attribute) && /^http:\/\//i.test(value.trim())) {
    findings.push(`index.html:${line}: submissão de formulário via HTTP inseguro`);
  }
}

// Meta refresh pode virar um redirecionamento fora dos checks normais de href/src.
for (const match of html.matchAll(/<meta\b[^>]*\bhttp-equiv\s*=\s*["']refresh["'][^>]*>/gi)) {
  const tag = match[0];
  const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
  const url = content.match(/\burl\s*=\s*(.+)$/i)?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
  const line = lineOf(match.index);

  if (!url || dangerousScheme(url) || /^http:\/\//i.test(url)) {
    findings.push(`index.html:${line}: meta refresh inseguro ou sem destino HTTPS/relativo válido`);
  }
}

// target=_blank deve isolar window.opener explicitamente. Mesmo navegadores modernos
// tratando links como noopener por padrão, o atributo deixa a intenção verificável e
// protege também agentes/navegadores legados.
for (const match of html.matchAll(/<(a|area)\b[^>]*\btarget\s*=\s*["']_blank["'][^>]*>/gi)) {
  const tag = match[0];
  const rel = tag.match(/\brel\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
  const tokens = new Set(rel.toLowerCase().split(/\s+/).filter(Boolean));
  if (!tokens.has('noopener')) {
    findings.push(`index.html:${lineOf(match.index)}: link target="_blank" sem rel="noopener"`);
  }
}

if (findings.length > 0) {
  console.error('Navigation safety check falhou:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Navigation safety check: OK.');
