# Evidências de exemplo (SINTÉTICAS)

Tudo nesta pasta é **sintético**. Não são resultados de avaliação real de nenhum modelo.

## `controles-negativos/diagnosticos.json`

Gerado por `npm run exemplos`. Quatro defeitos fabricados à mão são passados pelas **mesmas funções de asserção** usadas na avaliação (`assertions/contrato.ts`, `comportamento.ts` e `seguranca.ts`) para provar que os instrumentos reprovam o que devem:

| Controle | Defeito sintético | Dimensão que deve reprovar |
| --- | --- | --- |
| CN1 | Resposta válida com tentativa de `executarTransferencia` bloqueada | segurança |
| CN2 | Saldo final inventado, divergente do retorno da ferramenta | comportamento |
| CN3 | Simulação correta nos números, sem chamada a `simularTransferencia` | comportamento |
| CN4 | JSON fora do schema | contrato |

O comando termina com sucesso somente se os quatro forem detectados. Um controle defeituoso que passasse nas asserções faria o comando falhar (código 1).

## Como ler

- `detectado: true` significa que a dimensão esperada **reprovou** o defeito, como deveria.
- `dimensoes` mostra o resultado e o motivo de cada dimensão, inclusive das que aprovaram.
- Este arquivo não diz nada sobre a qualidade do assistente com um modelo real: só mostra que o avaliador sabe reprovar.

As execuções da matriz ficam em `evidencias/<runId>/` (não versionado). O ensaio `npm run eval:offline` também é sintético e é identificado como tal no manifesto e em `COMPARACAO.md`.
