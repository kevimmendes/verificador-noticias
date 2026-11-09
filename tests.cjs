const assert = require('node:assert/strict');
const core = require('./core.js');

const SOLID =
  'Segundo o relatório anual de 2025 da Direção-Geral da Saúde, publicado a 12 de março, a taxa de vacinação ' +
  'contra a gripe entre pessoas com mais de 65 anos subiu para 62% na época 2024/2025. O documento está ' +
  'disponível em https://www.dgs.pt e compara os dados com os das três épocas anteriores.';

const BAD =
  'URGENTE!!! PARTILHE ANTES QUE APAGUEM! A comunicação social não mostra isto: um estudo que ninguém quer ' +
  'divulgar revela que 87% dos medicamentos vendidos em Portugal estão contaminados. Especialistas alertam que ' +
  'isto vai mudar tudo. Recebi no WhatsApp e já está a circular em todos os grupos. Ninguém está a falar disto!!!';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok - ' + name);
}

test('texto vazio devolve resultado vazio', () => {
  const r = core.analyze('   ');
  assert.equal(r.empty, true);
  assert.equal(r.score, 0);
  assert.equal(r.level.id, 'baixo');
});

test('notícia com fonte tem índice baixo', () => {
  const r = core.analyze(SOLID, { url: 'https://www.dgs.pt' });
  assert.ok(r.score <= 20, 'score inesperado: ' + r.score);
  assert.equal(r.level.id, 'baixo');
  assert.ok(r.signals.some((s) => s.id === 'attribution'), 'falta o sinal de fonte nomeada');
  assert.ok(r.signals.some((s) => s.id === 'link'), 'falta o sinal de ligação');
});

test('encaminhamento suspeito tem índice alto', () => {
  const r = core.analyze(BAD, { origin: 'WhatsApp / grupo' });
  assert.ok(r.score >= 55, 'score inesperado: ' + r.score);
  for (const id of ['caps', 'share', 'vague_source', 'conspiracy', 'forward', 'origin_whatsapp', 'stats']) {
    assert.ok(r.signals.some((s) => s.id === id), 'sinal em falta: ' + id);
  }
});

test('percentagem sem fonte é sinalizada', () => {
  const r = core.analyze('Atenção: 87% das pessoas já passaram por isto.');
  assert.ok(r.signals.some((s) => s.id === 'stats'));
});

test('pesos positivos e negativos entram na conta', () => {
  const r = core.analyze(BAD);
  const sum = r.signals.reduce((a, s) => a + s.weight, 0);
  const esperado = Math.max(0, Math.min(100, Math.round(core.BASE + sum)));
  assert.equal(r.score, esperado);
});

test('índice nunca sai de 0 a 100', () => {
  const enorme = BAD.repeat(40);
  const r = core.analyze(enorme, { origin: 'WhatsApp / grupo' });
  assert.ok(r.score >= 0 && r.score <= 100);
});

test('ligações de verificação estão bem formadas', () => {
  const r = core.analyze(BAD, { url: 'https://exemplo.pt/noticia?x=1&y=2' });
  assert.ok(r.links.length >= 4);
  for (const l of r.links) {
    assert.match(l.url, /^https:\/\//);
    assert.ok(!l.url.includes('undefined'));
    assert.ok(!l.url.includes(' '));
  }
  assert.ok(r.links.some((l) => l.url.includes('web.archive.org/save/')));
});

test('o destaque escapa HTML do texto colado', () => {
  const r = core.analyze('URGENTE <script>alert(1)</script> PARTILHE!!! especialistas alertam');
  assert.ok(!/<script/i.test(r.highlighted), 'HTML não foi escapado');
  assert.ok(/&lt;script&gt;/.test(r.highlighted));
  assert.ok(/<mark class="risk">/.test(r.highlighted));
});

test('o destaque preserva o texto quando nada casa', () => {
  const r = core.analyze('Reunião de condóminos na terça-feira, pelas 20 horas, na sala comum.');
  assert.ok(r.highlighted.includes('Reunião de condóminos'));
});

test('não rebenta com caracteres de regex', () => {
  const r = core.analyze('a ( b ) [c] {d} * + ? ^ $ | \\ / 100% $1 \n\n\n fim');
  assert.equal(typeof r.score, 'number');
});

test('catálogo de regras expõe metadados coerentes', () => {
  assert.ok(core.RULES.length >= 12);
  for (const r of core.RULES) {
    assert.ok(r.label.length > 3);
    assert.equal(typeof r.weight, 'number');
    assert.ok(['risk', 'safe'].includes(r.kind));
  }
});

console.log('\n' + passed + ' testes passaram');
