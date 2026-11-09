(function () {
  'use strict';

  var core = window.VerificadorCore;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var els = {
    form: $('#form'),
    conteudo: $('#conteudo'),
    fonte: $('#fonte'),
    origem: $('#origem'),
    contador: $('#contador'),
    resultado: $('#resultado'),
    tabela: $('#tabela-pesos')
  };

  var EXEMPLOS = {
    mau:
      'URGENTE!!! PARTILHE ANTES QUE APAGUEM! A comunicação social não mostra isto: um estudo que ninguém quer ' +
      'divulgar revela que 87% dos medicamentos vendidos em Portugal estão contaminados. Especialistas alertam que ' +
      'isto vai mudar tudo. Recebi no WhatsApp e já está a circular em todos os grupos. Ninguém está a falar disto!!!',
    bom:
      'Segundo o relatório anual de 2025 da Direção-Geral da Saúde, publicado a 12 de março, a taxa de vacinação ' +
      'contra a gripe entre pessoas com mais de 65 anos subiu para 62% na época 2024/2025. O documento está ' +
      'disponível em https://www.dgs.pt e compara os dados com os das três épocas anteriores, atribuindo a subida ' +
      'à dispensa de receita nas farmácias comunitárias.'
  };

  var PASSOS = [
    'Quem publicou? Procura o nome do autor e do órgão. Domínios que imitam os verdadeiros são sinal de alarme.',
    'Existe fonte primária? Relatório, comunicado, decisão judicial, dados oficiais (INE, DGS, Eurostat).',
    'De quando é? Muita desinformação é conteúdo verdadeiro, mas antigo, reaproveitado fora de tempo.',
    'A frase aparece noutros lados? Pesquisa a frase exata entre aspas.',
    'A imagem ou o vídeo existem noutro contexto? Faz pesquisa inversa na aba ao lado.',
    'O texto pede pressa e partilha? Isso é técnica de propagação, não sinal de importância.'
  ];

  /* ---------- separadores ---------- */

  var tabs = $$('.tab');
  var paineis = {};
  tabs.forEach(function (t) {
    paineis[t.getAttribute('data-tab')] = $('#painel-' + t.getAttribute('data-tab'));
  });

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var alvo = tab.getAttribute('data-tab');
      tabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
      });
      Object.keys(paineis).forEach(function (k) {
        if (paineis[k]) paineis[k].classList.toggle('hidden', k !== alvo);
      });
      if (alvo === 'texto' && els.resultado && !els.resultado.classList.contains('hidden')) {
        els.resultado.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    });
  });

  /* ---------- contador de palavras ---------- */

  function atualizarContador() {
    var texto = els.conteudo.value.trim();
    var n = texto ? texto.split(/\s+/).length : 0;
    els.contador.textContent = n + (n === 1 ? ' palavra' : ' palavras');
  }

  els.conteudo.addEventListener('input', atualizarContador);

  /* Ctrl/Cmd + Enter analisa */

  els.conteudo.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      analisar();
    }
  });

  /* ---------- ações ---------- */

  els.form.addEventListener('submit', function (e) {
    e.preventDefault();
    analisar();
  });

  $('#exemplo-mau').addEventListener('click', function () {
    els.conteudo.value = EXEMPLOS.mau;
    els.fonte.value = '';
    els.origem.value = 'WhatsApp / grupo';
    atualizarContador();
    analisar();
  });

  $('#exemplo-bom').addEventListener('click', function () {
    els.conteudo.value = EXEMPLOS.bom;
    els.fonte.value = 'https://www.dgs.pt';
    els.origem.value = 'Site de notícias';
    atualizarContador();
    analisar();
  });

  $('#limpar').addEventListener('click', function () {
    els.conteudo.value = '';
    els.fonte.value = '';
    els.origem.value = '';
    atualizarContador();
    els.resultado.classList.add('hidden');
    els.resultado.innerHTML = '';
    els.conteudo.focus();
  });

  /* ---------- utilidades ---------- */

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function contar(el, alvo) {
    if (reduceMotion) { el.textContent = String(alvo); return; }
    var inicio = null;
    var duracao = 900;
    function passo(ts) {
      if (inicio === null) inicio = ts;
      var p = Math.min(1, (ts - inicio) / duracao);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(alvo * eased));
      if (p < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }

  /* ---------- render ---------- */

  function analisar() {
    var texto = els.conteudo.value;
    if (!texto.trim()) {
      els.conteudo.focus();
      return;
    }

    var res = core.analyze(texto, { url: els.fonte.value.trim(), origin: els.origem.value });
    render(res);
    els.resultado.classList.remove('hidden');
    els.resultado.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function render(res) {
    var riscos = res.signals.filter(function (s) { return s.kind === 'risk'; });
    var ajudas = res.signals.filter(function (s) { return s.kind === 'safe'; });

    var html = '';

    /* cartão de pontuação */
    html += '<div class="card scorecard level-' + res.level.id + '">' +
      '<div class="ring" style="--pct:' + res.score + '; --ring: var(--' +
        (res.level.id === 'baixo' ? 'safe' : res.level.id === 'critico' ? 'risk' : res.level.id === 'alto' ? 'warn' : 'warn') +
      ')">' +
        '<svg viewBox="0 0 120 120" aria-hidden="true">' +
          '<circle class="track" cx="60" cy="60" r="52"></circle>' +
          '<circle class="val" cx="60" cy="60" r="52"></circle>' +
        '</svg>' +
        '<div class="ringlabel"><span class="num" id="num-final">0</span><span class="of">de 100</span></div>' +
      '</div>' +
      '<div class="scoretext">' +
        '<span class="level">' + esc(res.level.label) + '</span>' +
        '<h2>Índice de alerta: ' + res.score + '/100</h2>' +
        '<p>' + esc(res.level.advice) + '</p>' +
      '</div>' +
      '<p class="finalnote">Este índice mede marcas de linguagem, não a verdade. ' +
        riscos.length + (riscos.length === 1 ? ' sinal de alarme' : ' sinais de alarme') +
        ' e ' + ajudas.length + (ajudas.length === 1 ? ' sinal a favor' : ' sinais a favor') + '.</p>' +
    '</div>';

    /* sinais */
    html += '<div class="grid2">';

    html += '<div class="card"><h2>Sinais de alarme <span class="count">' + riscos.length + '</span></h2>';
    if (!riscos.length) {
      html += '<p class="empty">Nenhum dos padrões conhecidos foi encontrado neste texto.</p>';
    } else {
      html += '<ul class="signals">';
      riscos.forEach(function (s, i) {
        html += '<li class="risk" style="animation-delay:' + (i * 45) + 'ms">' +
          '<div class="sighead"><strong>' + esc(s.label) + '</strong><span class="w">+' + s.weight + '</span></div>' +
          '<p>' + esc(s.detail) + '</p>' +
          (s.evidence.length ? '<div class="ev">' + s.evidence.map(function (ev) { return '<code>' + esc(ev) + '</code>'; }).join('') + '</div>' : '') +
        '</li>';
      });
      html += '</ul>';
    }
    html += '</div>';

    html += '<div class="card"><h2>Sinais a favor <span class="count">' + ajudas.length + '</span></h2>';
    if (!ajudas.length) {
      html += '<p class="empty">Nada no texto permite confirmar a afirmação. Isto, por si só, não a torna falsa — só não a sustenta.</p>';
    } else {
      html += '<ul class="signals">';
      ajudas.forEach(function (s, i) {
        html += '<li class="safe" style="animation-delay:' + (i * 45) + 'ms">' +
          '<div class="sighead"><strong>' + esc(s.label) + '</strong><span class="w">' + s.weight + '</span></div>' +
          '<p>' + esc(s.detail) + '</p>' +
          (s.evidence.length ? '<div class="ev">' + s.evidence.map(function (ev) { return '<code>' + esc(ev) + '</code>'; }).join('') + '</div>' : '') +
        '</li>';
      });
      html += '</ul>';
    }
    html += '</div>';

    html += '</div>';

    /* destaques */
    html += '<div class="card"><h2>Onde apareceram</h2>' +
      '<div class="preview">' + res.highlighted.replace(/\n/g, '<br>') + '</div>' +
      '<p class="legend"><span class="dot risk"></span>sinal de alarme ' +
        '<span class="dot safe" style="margin-left:12px"></span>sinal a favor ' +
        '<span style="margin-left:12px">— as marcas mostram o excerto, não a conclusão</span></p>' +
    '</div>';

    /* roteiro + pesquisas */
    html += '<div class="card">' +
      '<p class="eyebrow-2">Passo 3 — ir à fonte</p>' +
      '<h2 style="margin-bottom:4px">Roteiro de verificação</h2>' +
      '<ol class="steps">' + PASSOS.map(function (p) {
        var partes = p.split('?');
        if (partes.length > 1) {
          return '<li><h3>' + esc(partes[0]) + '?</h3><p>' + esc(partes.slice(1).join('?').trim()) + '</p></li>';
        }
        return '<li><h3>' + esc(p) + '</h3></li>';
      }).join('') + '</ol>' +
      '<h3 class="h3">Pesquisas já preenchidas</h3>' +
      '<ul class="linklist">' + res.links.map(function (l) {
        return '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>' +
          '<span>' + esc(l.note) + '</span></li>';
      }).join('') + '</ul>' +
      '<div class="actions">' +
        '<button type="button" class="btn primary" id="copiar">Copiar lista de verificação</button>' +
        '<button type="button" class="btn ghost" id="imprimir">Imprimir / PDF</button>' +
      '</div>' +
      '<p class="hint" id="copiado" hidden>Lista copiada.</p>' +
    '</div>';

    els.resultado.innerHTML = html;

    var num = $('#num-final');
    if (num) contar(num, res.score);

    var copiar = $('#copiar');
    if (copiar) {
      copiar.addEventListener('click', function () {
        var texto = 'Verificação de uma notícia\n\n' +
          'Índice de alerta: ' + res.score + '/100 — ' + res.level.label + '\n' +
          'Sinais de alarme: ' + (riscos.length ? riscos.map(function (s) { return s.label; }).join('; ') : 'nenhum') + '\n' +
          'Sinais a favor: ' + (ajudas.length ? ajudas.map(function (s) { return s.label; }).join('; ') : 'nenhum') + '\n\n' +
          'Checklist:\n' + PASSOS.map(function (p, i) { return (i + 1) + '. ' + p; }).join('\n');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(texto).then(function () {
            var c = $('#copiado');
            if (c) { c.hidden = false; }
          });
        }
      });
    }

    var imprimir = $('#imprimir');
    if (imprimir) imprimir.addEventListener('click', function () { window.print(); });
  }

  /* ---------- tabela de pesos ---------- */

  function renderPesos() {
    if (!els.tabela || els.tabela.dataset.feito) return;
    els.tabela.innerHTML = core.RULES.slice()
      .sort(function (a, b) { return b.weight - a.weight; })
      .map(function (r) {
        return '<tr class="' + r.kind + '"><td>' + esc(r.label) + '</td><td class="w">' +
          (r.weight > 0 ? '+' : '') + r.weight + '</td><td>' + esc(r.detail) + '</td></tr>';
      }).join('');
    els.tabela.dataset.feito = '1';
  }

  /* números do motor mostrados na página, para nunca desalinharem */
  (function sincronizarNumeros() {
    var risco = core.RULES.filter(function (r) { return r.kind === 'risk'; }).length;
    var pares = [['#num-sinais', core.RULES.length], ['#num-risco', risco], ['#num-safe', core.RULES.length - risco]];
    pares.forEach(function (par) {
      var el = $(par[0]);
      if (el) el.textContent = String(par[1]);
    });
  })();

  atualizarContador();
  renderPesos();
})();
