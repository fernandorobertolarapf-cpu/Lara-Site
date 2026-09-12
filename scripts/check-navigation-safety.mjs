import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const NAMED_ENTITIES = new Map([
  ['colon', ':'],
  ['tab', '\t'],
  ['newline', '\n'],
]);

/**
 * Decodifica as referencias que podem mudar a interpretacao de um esquema.
 * Numericas sao importantes porque o navegador transforma, por exemplo,
 * `java&#x73;cript:` em `javascript:` antes de navegar.
 */
export function decodeHtmlEntities(value = '') {
  return String(value)
    .replace(/&#(?:x([0-9a-f]+)|([0-9]+));?/gi, (match, hex, decimal) => {
      const codePoint = Number.parseInt(hex ?? decimal, hex ? 16 : 10);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
      try { return String.fromCodePoint(codePoint); } catch { return match; }
    })
    .replace(/&(colon|tab|newline);?/gi, (match, name) => NAMED_ENTITIES.get(name.toLowerCase()) ?? match);
}

export function normalizeUrl(value = '') {
  return decodeHtmlEntities(value)
    .replace(/[\u0000-\u0020\u007f-\u009f]+/g, '')
    .toLowerCase();
}

export function dangerousScheme(value = '') {
  const normalized = normalizeUrl(value);
  return normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('data:text/html') ||
    normalized.startsWith('data:application/xhtml+xml');
}

function attributesOf(tag) {
  const attributes = new Map();
  const attrRe = /\b([^\s"'<>\/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(attrRe)) {
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attributes.set(match[1].toLowerCase(), decodeHtmlEntities(value));
  }
  return attributes;
}

function stripOuterQuotes(value) {
  const trimmed = String(value || '').trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/** Analisa HTML sem executar nada e devolve achados com linha aproximada. */
export function scanNavigationSafety(html) {
  const findings = [];
  const lineOf = (offset) => html.slice(0, offset ?? 0).split('\n').length;
  const navigationAttributes = ['href', 'src', 'action', 'formaction'];

  for (const match of html.matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi)) {
    const tagName = match[1].toLowerCase();
    const tag = match[0];
    const attributes = attributesOf(tag);
    const line = lineOf(match.index);

    for (const attribute of navigationAttributes) {
      if (!attributes.has(attribute)) continue;
      const value = attributes.get(attribute) ?? '';

      if (dangerousScheme(value)) {
        findings.push(`index.html:${line}: ${attribute} usa esquema de URL executavel/perigoso`);
      }

      if ((attribute === 'action' || attribute === 'formaction') && normalizeUrl(value).startsWith('http://')) {
        findings.push(`index.html:${line}: submissao de formulario via HTTP inseguro`);
      }
    }

    // Meta refresh pode virar redirecionamento fora de href/src.
    if (tagName === 'meta' && String(attributes.get('http-equiv') || '').trim().toLowerCase() === 'refresh') {
      const content = attributes.get('content') ?? '';
      const url = stripOuterQuotes(content.match(/(?:^|;)\s*url\s*=\s*(.+)$/i)?.[1] ?? '');
      if (!url || dangerousScheme(url) || normalizeUrl(url).startsWith('http://')) {
        findings.push(`index.html:${line}: meta refresh inseguro ou sem destino HTTPS/relativo valido`);
      }
    }

    // target=_blank deve isolar window.opener explicitamente.
    if ((tagName === 'a' || tagName === 'area') &&
        String(attributes.get('target') || '').trim().toLowerCase() === '_blank') {
      const rel = String(attributes.get('rel') || '');
      const tokens = new Set(rel.toLowerCase().split(/\s+/).filter(Boolean));
      if (!tokens.has('noopener')) {
        findings.push(`index.html:${line}: link target="_blank" sem rel="noopener"`);
      }
    }
  }

  return findings;
}

export function checkFile(fileUrl = new URL('../index.html', import.meta.url)) {
  const html = readFileSync(fileUrl, 'utf8');
  return scanNavigationSafety(html);
}

const isCli = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isCli) {
  const findings = checkFile();
  if (findings.length > 0) {
    console.error('Navigation safety check falhou:');
    for (const finding of findings) console.error(`- ${finding}`);
    process.exit(1);
  }
  console.log('Navigation safety check: OK.');
}
