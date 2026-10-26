# Bank Lab

Projeto educacional desenvolvido para demonstração de conceitos.

O projeto simula operações bancárias, como criação de contas, saques, depósitos e transferências entre contas, utilizando **Node.js, TypeScript, Next.js e Jest**.

Seu objetivo é demonstrar práticas de **Test-Driven Development (TDD)**, aplicando o ciclo RED → GREEN → REFACTOR, com apoio de agentes de codificação.

As funcionalidades são implementadas progressivamente, a partir de critérios de aceite e testes automatizados, permitindo explorar regras de negócio, cenários de sucesso, falhas e valores-limite.

O projeto também utiliza `AGENTS.md` para orientar os agentes de IA e especificações em `specs/` para definir os comportamentos esperados.

## Tecnologias

- Node.js
- TypeScript (strict)
- Next.js (App Router) e React
- Jest (via `next/jest`)
- Agentes de codificação

## Estrutura

```text
src/
├── domain/        # Conta, NumeroConta, TransferenciaValor, Recibo, ErroNegocio
├── application/   # adaptador que liga a API ao domínio (transferencias/operacao.ts)
├── api/           # handler HTTP testável sem servidor (transferencias/handler.ts)
└── app/           # Next.js: página mínima e rota POST /api/transferencias
tests/
├── domain/        # testes unitários do domínio
└── api/           # testes do handler (mock) e de integração com o domínio real
specs/             # especificações (fonte de verdade)
```

## Executando

Instale as dependências:

```bash
npm install
```

Scripts disponíveis:

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento do Next.js |
| `npm run build` | Build de produção do Next.js |
| `npm start` | Executa o build de produção |
| `npm test` | Executa a suíte Jest |
| `npm run test:watch` | Jest em modo watch |
| `npm run test:coverage` | Jest com cobertura |
| `npm run typecheck` | Verificação de tipos (`tsc --noEmit`) |
| `npm run build:ts` | Transpila apenas `src/domain` e `tests` para `dist/` |

## API de transferências

`POST /api/transferencias` (contrato em `specs/api-transferencias.md`):

```bash
curl -X POST localhost:3000/api/transferencias \
  -d '{"contaOrigem":"123456","contaDestino":"654321","valor":300}'
# 201 {"comprovante":"123456"}
```

Erros retornam `{"erro":"<CODIGO>"}`:

| HTTP | Código |
| --- | --- |
| 400 | `REQUISICAO_INVALIDA`, `CONTA_INVALIDA`, `VALOR_INVALIDO` |
| 404 | `CONTA_NAO_ENCONTRADA` |
| 422 | `MESMA_CONTA`, `SALDO_INSUFICIENTE` |
| 500 | `ERRO_INTERNO` |

A rota usa um cadastro em memória didático (contas `123456` com saldo 1000 e `654321` com 200). O estado é perdido ao reiniciar e não há suporte a concorrência.
