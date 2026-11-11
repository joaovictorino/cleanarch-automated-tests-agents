# Bank Lab

Projeto educacional desenvolvido para demonstração de conceitos.

O projeto simula operações bancárias, como criação de contas, saques, depósitos e transferências entre contas, utilizando **Node.js, TypeScript, Next.js e Jest**.

Seu objetivo é demonstrar práticas de **Test-Driven Development (TDD)**, aplicando o ciclo RED → GREEN → REFACTOR, com apoio de agentes de codificação.

As funcionalidades são implementadas progressivamente, a partir de critérios de aceite e testes automatizados, permitindo explorar regras de negócio, cenários de sucesso, falhas e valores-limite.

O projeto também utiliza `AGENTS.md` para orientar os agentes de IA e especificações em `specs/` para definir os comportamentos esperados.

## Aulas

| Aula | Foco | Specs |
| --- | --- | --- |
| 01 | Domínio bancário com TDD | `specs/aula01/` |
| 02 | Next.js, APIs de contas e transferência, mocks e integração, BDD, CI, cobertura, mutação e análise estática | `specs/aula02/` |
| 03 | Testes E2E (Playwright), carga (k6) e PostgreSQL local opcional | `specs/aula03/` |
| 04 | Chat com a turma, testes e avaliação de IA | `specs/SPEC_LABORATORIO_04_CHAT.md`, `specs/01-CONSTRUIR-CHAT.md`, `specs/02-TESTAR-APLICACAO.md`, `specs/03-AVALIAR-IA.md` |

## Tecnologias

- Node.js 24 e TypeScript (strict)
- Next.js (App Router) e React
- Jest (via `next/jest`; `jest.domain.config.cjs` com ts-jest para mutação)
- Cucumber.js (BDD), Playwright (E2E), k6 (carga)
- Stryker (mutação) e SonarQube (análise estática)
- PostgreSQL via Docker (opcional, apenas demonstração manual)
- Agentes de codificação

## Estrutura

```text
src/
├── domain/          # Conta, NumeroConta, TransferenciaValor, Recibo, ErroNegocio
├── application/     # adaptadores entre API e domínio
│   ├── contas/            # operações de contas
│   ├── transferencias/    # operação de transferência
│   ├── postgres/          # implementação PostgreSQL (opcional)
│   ├── armazenamento.ts   # seleção do armazenamento (memory | postgres)
│   └── estado-contas.ts   # Map demonstrativo compartilhado
├── api/             # handlers HTTP testáveis sem servidor
│   ├── contas/
│   └── transferencias/
└── app/             # Next.js (App Router)
    ├── page.tsx, layout.tsx
    ├── transferencias/    # tela didática de transferência
    └── api/
        ├── contas/            # POST /api/contas, GET /api/contas/[id]
        └── transferencias/    # POST /api/transferencias
tests/
├── domain/          # testes unitários do domínio
├── api/             # mock, integração e armazenamento
└── e2e/             # Playwright (+ fixtures)
features/            # Cucumber: cenários, step-definitions/ e support/ (World)
perf/                # script k6 de consulta (consulta.ts)
db/migrations/       # SQL puro (001_criar_contas.sql)
scripts/             # db/migrate.ts, db/seed.ts, verificar-bdd.cjs
specs/               # especificações (fonte de verdade)
├── aula01/ aula02/ aula03/
└── SPEC_LABORATORIO_04_CHAT.md, 01-CONSTRUIR-CHAT.md, 02-TESTAR-APLICACAO.md, 03-AVALIAR-IA.md
prompts/             # prompts v1 e v2 do chat (Aula 04)
dataset/             # casos.json e ajuste.json para avaliação (Aula 04)
templates/           # RELATORIO.md e RUBRICA.md
evidencias/          # evidências geradas (ex.: resultados do k6)
```

Arquivos de configuração na raiz: `jest.config.cjs`, `jest.domain.config.cjs`, `cucumber.cjs`, `playwright.config.ts`, `stryker.config.json`, `sonar-project.properties`, `docker-compose.yaml`, `tsconfig*.json`.

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
| `npm run typecheck:k6` | Verificação de tipos do script k6 |
| `npm run build:ts` | Transpila apenas `src/domain` e `tests` para `dist/` |
| `npm run test:bdd` | Cenários Cucumber |
| `npm run test:bdd:dry` | Cucumber em dry-run (valida steps) |
| `npm run test:bdd:full` | Cucumber + verificação dos seis cenários |
| `npm run test:e2e` | Playwright (Chromium) |
| `npm run test:e2e:headed` | Playwright com navegador visível |
| `npm run test:e2e:report` | Abre o relatório do Playwright |
| `npm run db:migrate` | Aplica migrações no PostgreSQL local |
| `npm run db:seed` | Popula o PostgreSQL local |

## Armazenamento

O padrão é `CONTAS_STORAGE=memory`: as rotas de contas e transferência compartilham um Map em memória, inicialmente vazio, perdido ao reiniciar e sem suporte a concorrência. O PostgreSQL (Docker, `pg`, SQL puro) só é usado com `CONTAS_STORAGE=postgres`, apenas na demonstração manual; `DATABASE_URL` sozinha não o ativa. Jest, Cucumber, Playwright, k6 e CI não usam banco.

## API

Contratos em `specs/aula02/api-contas.md` e `specs/aula02/api-transferencias.md`.

`POST /api/transferencias`:

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
