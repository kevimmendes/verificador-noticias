/* Verificador de Notícias — motor heurístico.
   Funciona no navegador e em Node (para os testes). Nenhum texto sai do dispositivo. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VerificadorCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var BASE = 12;

  var STOPWORDS = ('a o as os um uma uns umas de do da dos das em no na nos nas por para com que e ou se ao aos à às é foi são ser ' +
    'mais como não já sobre entre depois antes muito também pelo pela isto isso este esta aquele aquela há tem ter vai ser está').split(' ');

  /* ---------- utilitários ---------- */

  function normalize(text) {
    return String(text == null ? '' : text)
      .replace(/\r/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function escapeRegExp(p) {
    return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function phraseRe(p, flags) {
    return new RegExp(escapeRegExp(p), flags || 'gi');
  }

  function uniq(list) {
    var seen = {};
    return list.filter(function (v) {
      var k = String(v).toLowerCase();
      if (!k || seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  /* Devolve todos os excertos que casam com um conjunto de regex. */
  function scan(text, regexes, limit) {
    var out = [];
    var max = limit || 8;
    for (var i = 0; i < regexes.length && out.length < max; i++) {
      var flags = regexes[i].flags.indexOf('g') === -1 ? regexes[i].flags + 'g' : regexes[i].flags;
      var re = new RegExp(regexes[i].source, flags);
      var m;
      while ((m = re.exec(text)) !== null) {
        var hit = m[0].replace(/\s+/g, ' ').trim();
        if (hit) out.push(hit);
        if (m.index === re.lastIndex) re.lastIndex++;
        if (out.length >= max) break;
      }
    }
    return uniq(out).slice(0, max);
  }

  /* ---------- vocabulário ---------- */

  var PHRASES = {
    clickbait: [
      'não vai acreditar', 'não vão acreditar', 'inacreditável', 'chocante', 'escândalo',
      'a verdade sobre', 'o que ninguém diz', 'o que ninguém mostra', 'ninguém está a falar disto',
      'vai mudar tudo', 'viu isto', 'revelado', 'a verdade que escondem', 'ninguém quer que saibas'
    ],
    share: [
      'partilhe', 'partilha isto', 'partilhem', 'compartilhe', 'reencaminhe', 'reenvie',
      'envie para', 'passa a palavra', 'antes que apaguem', 'antes que seja removido',
      'guarda este vídeo', 'difunde', 'espalha'
    ],
    urgency: [
      'urgente', 'última hora', 'atenção', 'agora mesmo', 'corre nas redes', 'já está a circular',
      'antes que seja tarde', 'não perca'
    ],
    vagueSource: [
      'estudos dizem', 'estudo diz', 'um estudo revela', 'cientistas afirmam', 'cientistas dizem',
      'especialistas alertam', 'especialistas dizem', 'médicos alertam', 'fontes seguras',
      'fontes bem informadas', 'segundo consta', 'consta que', 'há quem diga', 'dizem que',
      'um amigo disse', 'circula nas redes', 'é sabido que', 'todos sabem'
    ],
    conspiracy: [
      'a comunicação social esconde', 'a comunicação social não mostra', 'a imprensa não mostra',
      'a mídia esconde', 'não querem que saibas', 'verdade oculta', 'censurado', 'proibido divulgar',
      'vão apagar', 'silenciado', 'não é notícia porque'
    ],
    absolute: [
      '100% verdadeiro', 'prova definitiva', 'é oficial', 'confirmado oficialmente', 'garantido',
      'sem dúvida nenhuma', 'ninguém pode negar'
    ],
    forward: [
      'recebi no whatsapp', 'recebi por whatsapp', 'enviaram-me', 'está a circular',
      'corre nos grupos', 'copia e cola', 'reenviado muitas vezes', 'recebido de fonte segura'
    ]
  };

  var ATTRIBUTION_RE = [
    /de acordo com/gi,
    /em comunicado|comunicado d[eo]/gi,
    /fonte\s*:/gi,
    /(?:afirmou|declarou|referiu|explicou) (?:ao|à|em|que|aos|às)/gi,
    /nota de imprensa/gi,
    /confer[êe]ncia de imprensa/gi,
    /segundo (?:a|o|as|os)\s+[\p{L}\p{N}]/giu
  ];

  var INSTITUTIONS = [
    'ministério', 'assembleia da república', 'tribunal', 'hospital', 'câmara municipal',
    'polícia judiciária', 'procuradoria', 'comissão europeia', 'direção-geral', 'direção geral',
    'autoridade', 'instituto', 'universidade', 'faculdade', 'ordem dos', 'eurostat',
    'relatório', 'decreto-lei', 'portaria', 'inquérito'
  ];

  var DATE_RE = [
    /\b(?:19|20)\d{2}\b/g,
    /\b\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4})\b/g,
    /\b(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/gi
  ];

  var LINK_RE = [/https?:\/\/[^\s)]+/gi, /\bwww\.[^\s)]+/gi];

  /* ---------- contexto ---------- */

  function buildContext(text, opts) {
    var words = text.split(/\s+/).map(function (w) {
      return w.replace(/[^\p{L}\p{N}]/gu, '');
    }).filter(Boolean);

    return {
      text: text,
      lower: text.toLowerCase(),
      len: text.length,
      words: words,
      origin: (opts && opts.origin) || '',
      url: (opts && opts.url) || '',
      attribution: scan(text, ATTRIBUTION_RE, 4),
      links: scan(text, LINK_RE, 4),
      dates: scan(text, DATE_RE, 4),
      institutions: scan(text, INSTITUTIONS.map(function (p) { return phraseRe(p); }), 4)
    };
  }

  /* ---------- regras ---------- */

  function phraseRule(id, label, detail, weight, kind, list) {
    return {
      id: id, label: label, detail: detail, weight: weight, kind: kind,
      detect: function (c) {
        var ev = scan(c.text, list.map(function (p) { return phraseRe(p); }), 6);
        return ev.length ? { evidence: ev } : null;
      }
    };
  }

  var RULES = [
    phraseRule('clickbait', 'Título ou frase de engate', 'Expressões feitas para clicar ou para indignar, que substituem a informação pelo choque.', 10, 'risk', PHRASES.clickbait),
    phraseRule('share', 'Apelo a partilhar', 'Pedir que se espalhe «antes que apaguem» é uma técnica de propagação, não uma prova de urgência.', 10, 'risk', PHRASES.share),
    phraseRule('vague_source', 'Fonte vaga', '«Especialistas alertam» sem nome, instituição ou documento é uma fonte que não existe para efeitos de verificação.', 9, 'risk', PHRASES.vagueSource),
    phraseRule('conspiracy', 'Lógica de conspiração', 'A ideia de que «escondem» explica antecipadamente a ausência de provas e torna a afirmação impossível de refutar.', 9, 'risk', PHRASES.conspiracy),
    phraseRule('forward', 'Marca de reenvio', 'Texto que se apresenta como algo recebido e reenviado perdeu o rasto à origem.', 6, 'risk', PHRASES.forward),
    phraseRule('urgency', 'Urgência fabricada', 'A pressa é usada para que não haja tempo de confirmar.', 5, 'risk', PHRASES.urgency),
    phraseRule('absolute', 'Certeza absoluta', 'Afirmações «100% verdadeiras» ou «é oficial» sem documento são uma promessa, não uma prova.', 5, 'risk', PHRASES.absolute),

    {
      id: 'caps', label: 'Maiúsculas a gritar',
      detail: 'Palavras inteiras em maiúsculas dão intensidade a quem não tem argumentos. Em texto jornalístico são raras.',
      weight: 8, kind: 'risk',
      detect: function (c) {
        var caps = uniq(c.words.filter(function (w) {
          return w.length >= 4 && w === w.toUpperCase() && /\p{L}/u.test(w);
        }));
        var ratio = c.words.length ? caps.length / c.words.length : 0;
        if (caps.length >= 3 || (caps.length >= 2 && ratio >= 0.08)) return { evidence: caps.slice(0, 5) };
        return null;
      }
    },
    {
      id: 'exclam', label: 'Pontuação exagerada',
      detail: 'Sequências de !!! ou ??? tentam substituir a força do argumento pela força do sinal gráfico.',
      weight: 6, kind: 'risk',
      detect: function (c) {
        var ev = scan(c.text, [/[!?]{2,}/g], 5);
        var bangs = (c.text.match(/!/g) || []).length;
        if (ev.length || bangs >= 3) return { evidence: ev.length ? ev : ['!!!'] };
        return null;
      }
    },
    {
      id: 'stats', label: 'Número sem origem',
      detail: 'Percentagens e estatísticas dão aparência de rigor. Sem relatório, estudo ou instituição identificável, o número é décor.',
      weight: 7, kind: 'risk',
      detect: function (c) {
        if (c.attribution.length) return null;
        var ev = scan(c.text, [/\d+(?:[.,]\d+)?\s?%/g, /\b\d{1,3}(?:\.\d{3})+\b/g], 5);
        return ev.length ? { evidence: ev } : null;
      }
    },
    {
      id: 'question', label: 'Título em forma de pergunta',
      detail: 'A pergunta insinua sem afirmar, o que dificulta a responsabilização por uma falsidade.',
      weight: 3, kind: 'risk',
      detect: function (c) {
        var first = (c.text.split('\n')[0] || '').trim();
        if (first.length > 8 && first.length < 160 && /\?$/.test(first)) return { evidence: [first.slice(0, 70)] };
        return null;
      }
    },
    {
      id: 'short', label: 'Texto muito curto',
      detail: 'Achados e denúncias sem contexto, sem quem, quando e onde. Não dá para verificar o que não está escrito.',
      weight: 5, kind: 'risk',
      detect: function (c) {
        return c.len < 180 ? { evidence: [c.len + ' caracteres'] } : null;
      }
    },
    {
      id: 'no_source', label: 'Nenhuma fonte identificável',
      detail: 'Não há nome de pessoa, instituição, documento ou publicação citada. É a falha mais importante de todas.',
      weight: 7, kind: 'risk',
      detect: function (c) {
        if (c.len < 150) return null;
        if (c.attribution.length || c.institutions.length) return null;
        return { evidence: ['sem atribuição a qualquer entidade'] };
      }
    },
    {
      id: 'no_link', label: 'Sem ligação para a fonte',
      detail: 'Um link para o documento original permite confirmar em segundos. Sem ele, a confirmação fica por tua conta.',
      weight: 4, kind: 'risk',
      detect: function (c) {
        return c.links.length || c.url ? null : { evidence: ['nenhuma ligação no texto'] };
      }
    },
    {
      id: 'emoji', label: 'Excesso de emojis',
      detail: 'Muitos emojis num texto informativo são um sinal de conteúdo feito para circular, não para informar.',
      weight: 4, kind: 'risk',
      detect: function (c) {
        var m = c.text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || [];
        return m.length >= 5 ? { evidence: [m.length + ' emojis'] } : null;
      }
    },
    {
      id: 'origin_whatsapp', label: 'Chegou por reenvio',
      detail: 'Cadeias de WhatsApp e «ouvi dizer» são o canal onde a desinformação mais circula, porque ninguém sabe quem escreveu.',
      weight: 6, kind: 'risk',
      detect: function (c) {
        if (/whatsapp|grupo|boca a boca|telegram/i.test(c.origin)) return { evidence: [c.origin] };
        return null;
      }
    },

    {
      id: 'attribution', label: 'Fonte nomeada',
      detail: 'Há uma entidade, documento ou pessoa identificável a quem a afirmação é atribuída. É o sinal mais valioso de todos.',
      weight: -8, kind: 'safe',
      detect: function (c) {
        return c.attribution.length ? { evidence: c.attribution.slice(0, 3) } : null;
      }
    },
    {
      id: 'detail', label: 'Contexto concreto',
      detail: 'Datas, instituições e documentos tornam a afirmação verificável — e é isso que um texto honesto faz.',
      weight: -6, kind: 'safe',
      detect: function (c) {
        var ev = uniq(c.institutions.concat(c.dates));
        return ev.length >= 2 ? { evidence: ev.slice(0, 4) } : null;
      }
    },
    {
      id: 'link', label: 'Ligação presente',
      detail: 'Um link permite chegar ao original. Atenção: um link não prova nada por si — vê se o domínio é o do órgão real.',
      weight: -5, kind: 'safe',
      detect: function (c) {
        var ev = c.links.length ? c.links : (c.url ? [c.url] : []);
        return ev.length ? { evidence: ev.slice(0, 2) } : null;
      }
    }
  ];

  /* ---------- níveis ---------- */

  function levelFor(score) {
    if (score <= 20) return {
      id: 'baixo', label: 'Poucos sinais de alarme',
      advice: 'O texto não usa os truques mais comuns. Isso não o torna verdadeiro: confirma quem o publicou e procura a fonte original.'
    };
    if (score <= 45) return {
      id: 'medio', label: 'Alguns sinais de alarme',
      advice: 'Há elementos que pedem cautela. Antes de partilhar, procura a mesma informação num órgão de comunicação social de referência.'
    };
    if (score <= 70) return {
      id: 'alto', label: 'Muitos sinais de alarme',
      advice: 'O texto reúne vários padrões típicos de desinformação. Trata-o como não verificado até encontrares uma fonte primária.'
    };
    return {
      id: 'critico', label: 'Sinais fortes de alerta',
      advice: 'Parece um encaminhamento clássico de desinformação. Não partilhes e verifica cada afirmação por ti, começando pela origem.'
    };
  }

  /* ---------- pesquisas de verificação ---------- */

  function queryFrom(text, max) {
    var words = normalize(text).toLowerCase()
      .replace(/[^\p{L}\p{N}\s%]/gu, ' ')
      .split(/\s+/)
      .filter(function (w) { return w.length > 2 && STOPWORDS.indexOf(w) === -1; });
    return words.slice(0, max || 10).join(' ');
  }

  function buildLinks(text, url) {
    var q = queryFrom(text, 10);
    var enc = encodeURIComponent(q);
    var links = [
      { label: 'Procurar a frase exata no Google', url: 'https://www.google.com/search?q=%22' + enc + '%22', note: 'Se a frase só existe em sites duvidosos, isso já diz muito.' },
      { label: 'Google Fact Check Explorer', url: 'https://toolbox.google.com/factcheck/explorer/search/' + enc, note: 'Base de verificações publicadas em todo o mundo.' },
      { label: 'Polígrafo', url: 'https://poligrafo.sapo.pt/?s=' + enc, note: 'Verificador português.' },
      { label: 'Observador — Fact Check', url: 'https://www.google.com/search?q=site%3Aobservador.pt+%22fact+check%22+' + enc, note: 'Verificações publicadas pelo Observador.' },
      { label: 'EUvsDisinfo', url: 'https://euvsdisinfo.eu/?s=' + enc, note: 'Base europeia de desinformação documentada.' }
    ];
    if (url) {
      links.push({
        label: 'Guardar a página no Internet Archive',
        url: 'https://web.archive.org/save/' + encodeURIComponent(url),
        note: 'Guarda uma cópia antes de a apagarem.'
      });
    }
    return links;
  }

  /* ---------- destaque dos excertos ---------- */

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function highlight(text, signals) {
    var ranges = [];
    signals.forEach(function (s) {
      (s.evidence || []).forEach(function (ev) {
        if (!ev || ev.length < 3) return;
        var needle = ev.toLowerCase();
        var from = 0, found = 0;
        var hay = text.toLowerCase();
        while (found < 3) {
          var i = hay.indexOf(needle, from);
          if (i === -1) break;
          ranges.push({ start: i, end: i + ev.length, kind: s.kind });
          from = i + ev.length;
          found++;
        }
      });
    });
    if (!ranges.length) return escapeHtml(text);

    ranges.sort(function (a, b) { return a.start - b.start || b.end - a.end; });
    var merged = [];
    ranges.forEach(function (r) {
      var last = merged[merged.length - 1];
      if (last && r.start <= last.end) {
        last.end = Math.max(last.end, r.end);
        if (r.kind === 'risk') last.kind = 'risk';
      } else merged.push({ start: r.start, end: r.end, kind: r.kind });
    });

    var out = '';
    var pos = 0;
    merged.forEach(function (r) {
      if (r.start < pos) return;
      out += escapeHtml(text.slice(pos, r.start));
      out += '<mark class="' + r.kind + '">' + escapeHtml(text.slice(r.start, r.end)) + '</mark>';
      pos = r.end;
    });
    out += escapeHtml(text.slice(pos));
    return out;
  }

  /* ---------- análise ---------- */

  function analyze(text, opts) {
    opts = opts || {};
    var clean = normalize(text);

    if (clean.length < 3) {
      return {
        empty: true,
        score: 0,
        level: levelFor(0),
        signals: [],
        links: buildLinks(''),
        highlighted: '',
        counts: { risk: 0, safe: 0 }
      };
    }

    var c = buildContext(clean, opts);
    var signals = [];

    RULES.forEach(function (rule) {
      var r = rule.detect(c);
      if (!r) return;
      signals.push({
        id: rule.id,
        label: rule.label,
        detail: rule.detail,
        weight: rule.weight,
        kind: rule.kind,
        evidence: (r.evidence || []).slice(0, 6)
      });
    });

    var sum = signals.reduce(function (acc, s) { return acc + s.weight; }, 0);
    var score = Math.max(0, Math.min(100, Math.round(BASE + sum)));

    return {
      empty: false,
      score: score,
      level: levelFor(score),
      signals: signals,
      links: buildLinks(clean, opts.url),
      highlighted: highlight(clean, signals),
      counts: {
        risk: signals.filter(function (s) { return s.kind === 'risk'; }).length,
        safe: signals.filter(function (s) { return s.kind === 'safe'; }).length
      }
    };
  }

  return {
    analyze: analyze,
    levelFor: levelFor,
    queryFrom: queryFrom,
    BASE: BASE,
    RULES: RULES.map(function (r) {
      return { id: r.id, label: r.label, detail: r.detail, weight: r.weight, kind: r.kind };
    })
  };
});
