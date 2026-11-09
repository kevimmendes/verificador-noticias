# Antes de partilhar, verifica

Verificador de Notícias — projeto escolar de literacia mediática. Página única, sem dependências, que analisa um texto e mostra os **sinais de alarme** típicos de desinformação, com o roteiro para se chegar à fonte.

## O que faz

Colas uma notícia, uma mensagem ou uma afirmação e a app:

1. procura **19 indicadores** (16 de alarme e 3 a favor) — maiúsculas a gritar, apelos a partilhar, fontes vagas, números sem origem, urgência fabricada, lógica de conspiração, marcas de reenvio, fontes nomeadas, datas e documentos;
2. soma pesos a uma base de 12 e devolve um **índice de alerta de 0 a 100**, com medidor animado;
3. mostra cada sinal em separado, com o excerto que o acionou, para poderes discordar da máquina;
4. destaca esses excertos no texto original;
5. gera pesquisas de verificação já preenchidas (frase exata, Polígrafo, Fact Check Explorer, EUvsDisinfo) e a cópia arquivada da página;
6. imprime o resultado em PDF — útil para anexar ao relatório do projeto.

## O que não faz

Não diz se a notícia é verdadeira, e é importante perceber porquê: a verdade de uma afirmação está no mundo — documentos, dados, testemunhas — e não na sua pontuação linguística. Um texto bem escrito e sem fontes pode pontuar baixo e ser falso; um texto verdadeiro e indignado pode pontuar alto.

Também não acede à internet, não lê imagens e não vê quem publicou.

## Estrutura

- `index.html` — hero, quatro secções (Verificar · Imagem e vídeo · Como funciona · Sobre o projeto)
- `styles.css` — sistema de design completo, modo claro/escuro, movimento reduzido e estilos de impressão
- `core.js` — motor de análise, puro e reutilizável no navegador e em Node
- `app.js` — interface: separadores, medidor animado, contadores, atalho Ctrl+Enter, copiar e imprimir
- `tests.cjs` — 11 testes do motor com `node:assert`
- `build-single.cjs` — gera `verificador.html`, página autónoma com CSS e JS incorporados

## Correr

```bash
node tests.cjs                                     # testes do motor
python3 -m http.server 3000 --bind 0.0.0.0         # servidor local
```

Depois abrir `http://localhost:3000`.

## Publicar no GitHub Pages

```bash
node build-single.cjs
```

Gera `verificador.html`: um único ficheiro, sem dependências locais, que funciona por duplo clique. Para o pôr online, cria um repositório no GitHub, carrega esse ficheiro com o nome **`index.html`** e ativa **Settings → Pages → Deploy from a branch → `main` / `(root)`**. O endereço fica em `https://<utilizador>.github.io/<repositorio>/`.

## Para entregar

Na secção **Sobre o projeto**, substitui a linha da *Ficha* pelos teus dados (nome, turma, disciplina, escola, ano letivo). A tabela de pesos da secção **Como funciona** é gerada a partir das mesmas regras do motor, por isso nunca desalinha.

## Ajustar

Os pesos e as listas de expressões estão em `core.js` (objeto `PHRASES` e array `RULES`). Ao acrescentar uma regra, os contadores da página atualizam-se sozinhos.
