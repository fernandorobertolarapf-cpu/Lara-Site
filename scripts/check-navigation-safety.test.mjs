import test from 'node:test';
import assert from 'node:assert/strict';
import { dangerousScheme, scanNavigationSafety } from './check-navigation-safety.mjs';

test('aceita navegacao HTTPS/relativa e _blank isolado', () => {
  const html = `
    <a href="/entrar">Entrar</a>
    <a href=https://example.com target=_blank rel="nofollow noopener">Externo</a>
    <form action="/contato"></form>
  `;
  assert.deepEqual(scanNavigationSafety(html), []);
});

test('detecta esquema executavel mesmo com entidade numerica no nome', () => {
  assert.equal(dangerousScheme('java&#x73;cript&#58;alert(1)'), true);
  assert.equal(dangerousScheme('java&#115;cript:alert(1)'), true);
  const findings = scanNavigationSafety('<a href="java&#x73;cript&#58;alert(1)">x</a>');
  assert.equal(findings.length, 1);
  assert.match(findings[0], /esquema de URL executavel/);
});

test('detecta href executavel sem aspas', () => {
  const findings = scanNavigationSafety('<a href=javascript:alert(1)>x</a>');
  assert.equal(findings.length, 1);
  assert.match(findings[0], /href usa esquema/);
});

test('detecta action HTTP sem aspas e com controles/entidades', () => {
  const findings = scanNavigationSafety('<form action=http&#58;//example.com/login></form>');
  assert.equal(findings.length, 1);
  assert.match(findings[0], /HTTP inseguro/);
});

test('detecta target _blank sem noopener mesmo sem aspas', () => {
  const findings = scanNavigationSafety('<a href=https://example.com target=_blank rel=noreferrer>x</a>');
  assert.equal(findings.length, 1);
  assert.match(findings[0], /noopener/);
});

test('aceita target _blank quando noopener esta presente', () => {
  const findings = scanNavigationSafety('<a href=https://example.com target=_blank rel="noopener noreferrer">x</a>');
  assert.deepEqual(findings, []);
});

test('detecta meta refresh executavel ofuscado por entidade', () => {
  const findings = scanNavigationSafety('<meta http-equiv=refresh content="0; url=java&#x73;cript&#58;alert(1)">');
  assert.equal(findings.length, 1);
  assert.match(findings[0], /meta refresh inseguro/);
});

test('detecta meta refresh HTTP sem aspas', () => {
  const findings = scanNavigationSafety('<meta http-equiv=refresh content=0;url=http://example.com>');
  assert.equal(findings.length, 1);
  assert.match(findings[0], /meta refresh inseguro/);
});
