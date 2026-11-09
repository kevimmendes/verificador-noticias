/* Gera verificador.html: uma página autónoma, com CSS e JS incorporados,
   pronta a publicar em qualquer alojamento estático (GitHub Pages, por exemplo).

   Usa funções de substituição: uma string de substituição interpreta `$&`, `$'`
   e `$$`, o que corromperia o código embutido (o `escapeRegExp` do core.js
   contém literalmente `'\\$&'`). */
'use strict';

const fs = require('fs');
const path = require('path');

const dir = __dirname;
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

const html = read('index.html');
const css = read('styles.css');
const core = read('core.js');
const app = read('app.js');

const out = html
  .replace('<link rel="stylesheet" href="styles.css">', () => '<style>\n' + css + '\n</style>')
  .replace('<script src="core.js"></script>', () => '<script>\n' + core + '\n</script>')
  .replace('<script src="app.js"></script>', () => '<script>\n' + app + '\n</script>');

const checks = [
  ['sem referências a ficheiros locais', !/href="styles\.css"|src="core\.js"|src="app\.js"/.test(out)],
  ['CSS incorporado sem alterações', out.includes(css)],
  ['core.js incorporado sem alterações', out.includes(core)],
  ['app.js incorporado sem alterações', out.includes(app)],
  ['dois blocos de script', (out.match(/<script>/g) || []).length === 2],
  ['fecho de script apenas nos dois blocos', (out.match(/<\/script>/g) || []).length === 2],
  ['operador $$ preservado', out.includes('var $$ = function')],
  ['sequência $& preservada', out.includes("'\\\\$&'")]
];

let falhas = 0;
for (const [nome, ok] of checks) {
  console.log((ok ? 'ok - ' : 'FALHA - ') + nome);
  if (!ok) falhas++;
}

if (falhas) {
  console.error('\n' + falhas + ' verificação(ões) falharam: nada foi escrito.');
  process.exit(1);
}

const destino = path.join(dir, 'verificador.html');
fs.writeFileSync(destino, out);
console.log('\nverificador.html escrito: ' + (out.length / 1024).toFixed(1) + ' KB');
