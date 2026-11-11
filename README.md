# Bank Lab

Projeto educacional para demonstração de conceitos de qualidade de software.

O projeto simula operações bancárias (criação e consulta de contas, saque, depósito e transferência entre contas) com **Node.js 24, TypeScript, Next.js e Jest**, e serve de base para um percurso de aulas sobre desenvolvimento assistido por agentes e automação de testes:

| Aula | Foco |
| --- | --- |
| 01 | Domínio bancário com TDD (RED → GREEN → REFACTOR) |
| 02 | Next.js como adaptador HTTP, APIs de contas e transferência, testes de contrato/mock/integração, BDD com Cucumber, CI, cobertura, mutação (Stryker) e análise estática (SonarQube) |
| 03 | Testes E2E com Playwright, tela didática de transferência, diagnóstico de falhas, performance com k6 e PostgreSQL local opcional |
| 04 | Chat bancário didático com IA (`project-chat/`), testes da aplicação e avaliação de prompts V1 × V2 com Promptfoo |

O `AGENTS.md` orienta os agentes de IA (escopo, regras e validação por etapa) e as especificações em `specs/` são a fonte de verdade dos comportamentos esperados.

## Tecnologias

- Node.js >= 24.11, npm
- TypeScript (strict)
- Next.js 16 (App Router) e React 19
- Jest 30 (`next/jest`) e ts-jest (configuração do domínio, usada na mutação)
- Cucumber.js 13 com tsx (CommonJS)
- Playwright Test (Chromium, Firefox e WebKit configurados; CI usa Chromium)
- k6 (scripts em TypeScript com `@types/k6`)
- Stryker (mutação) e SonarQube/scanner via Docker
- PostgreSQL 17 via Docker e `pg` (opcional, só na demonstração manual)
- Aula 04 (`project-chat/`): Next.js 16, SDK `openai` (Azure/Responses API), Ajv, Jest e Promptfoo
- GitHub Actions

## Estrutura

```text
src/                    # aplicação bancária (Aulas 01–03)
├── domain/             # Conta, NumeroConta, TransferenciaValor, Recibo, ErroNegocio
├── application/        # operações de contas e transferências, estado em memória
│   └── postgres/       # repositório opcional (CONTAS_STORAGE=postgres)
├── api/                # handlers HTTP (contas, transferências), testáveis sem servidor
└── app/                # Next.js: página inicial, /transferencias e rotas /api
tests/
├── domain/             # testes unitários do domínio
├── api/                # handlers (mock) e integração com o domínio real
└── e2e/                # jornadas Playwright e fixtures
features/               # steps e World do Cucumber
perf/                   # script k6 de consulta
db/migrations/          # SQL puro (001_criar_contas.sql)
scripts/                # verificar-bdd.cjs; db/migrate.ts e db/seed.ts
specs/
├── aula01/             # regras da transferência e criação do domínio
├── aula02/             # Next.js, erros, APIs, mocks/integração, BDD, CI
├── aula03/             # laboratorio-03.md
└── 01-CONSTRUIR-CHAT.md, 02-TESTAR-APLICACAO.md, 03-AVALIAR-IA.md,
    SPEC_LABORATORIO_04_CHAT.md      # Aula 04
evidencias/             # saídas de k6 e diagnóstico (ignoradas pelo Git)
project-chat/           # Aula 04: aplicação independente (próprio package.json)
├── src/                # assistente, modelo, dominio, banco, api, app, trace
├── tests/              # unit, integration, evaluation
├── avaliacao/          # execução e comparação V1 × V2
├── assertions/ providers/ schemas/ prompts/ dataset/ templates/
├── scripts/            # smoke, avaliar, comparar, controles-negativos
├── evidencias/ evidencias-exemplo/ traces/
└── promptfooconfig.ts
```

## Executando

```bash
npm install
npm run dev        # http://localhost:3000
```

Páginas: `/` (inicial) e `/transferencias` (tela didática com campos Conta origem, Conta destino e Valor (R$), saldos e comprovante).

### Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento do Next.js |
| `npm run build` | Build de produção do Next.js |
| `npm start` | Executa o build de produção |
| `npm test` | Suíte Jest (domínio, mocks e integração) |
| `npm run test:watch` | Jest em modo watch |
| `npm run test:coverage` | Jest com cobertura (`coverage/lcov.info`) |
| `npm run typecheck` | Verificação de tipos (`tsc --noEmit`) |
| `npm run build:ts` | Transpila `src/domain` e `tests` para `dist/` |
| `npm run test:bdd` | Cenários Cucumber |
| `npm run test:bdd:dry` | Cucumber em dry-run (valida steps) |
| `npm run test:bdd:full` | Cucumber + `scripts/verificar-bdd.cjs` |
| `npm run test:e2e` | Playwright (projeto Chromium) |
| `npm run test:e2e:headed` | Playwright com navegador visível |
| `npm run test:e2e:report` | Abre o relatório HTML do Playwright |
| `npm run typecheck:k6` | Verificação de tipos dos scripts k6 |
| `npm run db:migrate` / `db:seed` | Migração e carga do PostgreSQL local (demonstração) |

> O Playwright sobe o servidor com `npm run start`; execute `npm run build` antes de `npm run test:e2e`.

Mutação (Stryker, alvo `src/domain/Conta.ts`):

```bash
npx stryker run     # relatórios em reports/mutation/
```

SonarQube (Docker; o token fica em `.env`, fora do Git):

```bash
docker compose up -d sonarqube          # http://localhost:9000
docker compose --profile scan run scanner
```

PostgreSQL local (opcional; o padrão é `CONTAS_STORAGE=memory`; `DATABASE_URL` em `.env.local` não o ativa sozinha):

```bash
docker compose up -d db
npm run db:migrate && npm run db:seed
CONTAS_STORAGE=postgres npm run start
```

## Chat (Aula 04)

`project-chat/` é uma aplicação separada (porta 3004) que consulta saldos e simula transferências via HTTP, sem executar movimentações. Instalação, variáveis do Azure, modo fake e avaliação estão em [`project-chat/README.md`](project-chat/README.md). O workflow `.github/workflows/lab04.yml` valida essa pasta offline e roda a avaliação Azure manualmente.

## API

O estado é um `Map` em memória, inicialmente **vazio**, compartilhado entre as rotas de contas e transferências no mesmo processo. Ele é perdido ao reiniciar e não há persistência, concorrência ou autenticação. Valores são números em **reais** com até duas casas decimais; contas têm seis dígitos.

### Contas (`specs/aula02/api-contas.md`)

```bash
curl -X POST localhost:3000/api/contas \
  -d '{"numero":"123456","saldoInicial":1000}'
# 201 {"numero":"123456","saldo":1000}

curl localhost:3000/api/contas/123456
# 200 {"numero":"123456","saldo":1000}
```

### Transferências (`specs/aula02/api-transferencias.md`)

```bash
curl -X POST localhost:3000/api/transferencias \
  -d '{"contaOrigem":"123456","contaDestino":"654321","valor":300}'
# 201 {"comprovante":"123456"}
```

Erros retornam `{"erro":"<CODIGO>"}` sem expor detalhes técnicos:

| HTTP | Código |
| --- | --- |
| 400 | `REQUISICAO_INVALIDA`, `CONTA_INVALIDA`, `VALOR_INVALIDO`, `SALDO_INVALIDO` (contas) |
| 404 | `CONTA_NAO_ENCONTRADA` |
| 409 | `CONTA_JA_EXISTE` (cadastro) |
| 422 | `MESMA_CONTA`, `SALDO_INSUFICIENTE` |
| 500 | `ERRO_INTERNO` |

## Testes e qualidade

- **Domínio**: testes unitários em `tests/domain`.
- **Handlers**: mocks verificam chamadas e respostas; integração usa `Conta` e `TransferenciaValor` reais, com `Map` novo por teste.
- **BDD**: cenários Cucumber em `specs/aula02/transferencias.feature`, com estado novo por cenário.
- **E2E (Aula 03)**: duas jornadas Playwright em `tests/e2e` (transferência aceita e saldo insuficiente), verificando tela e saldos no servidor. Trace, screenshot e vídeo de falhas vão para `test-results/` e o relatório para `playwright-report/`.
- **Performance (Aula 03)**: `perf/consulta.ts` (k6) mede `GET /api/contas/{numero}` por 30 s com `VUS` configurável (padrão 5) e thresholds de p95 < 500 ms, falhas < 1 % e checks > 99 %. Variáveis: `BASE_URL`, `VUS`. Execução de escrita não faz parte do escopo.
- **Aula 04**: testes unitários, de integração e de avaliação em `project-chat/tests` (`npm test` dentro da pasta) e avaliação V1 × V2 (`npm run eval:offline`, `eval`).
- **CI** (`.github/workflows`): `ci.yml` roda tipos, Jest com cobertura, BDD e build, publicando cobertura e relatórios Cucumber; `e2e.yml` roda o Playwright em Chromium e publica relatório e traces mesmo em caso de falha; `lab04.yml` valida `project-chat/` (tipos, testes, build, exemplos e ensaio offline).

## Especificações

- `specs/aula01/`: regras da transferência e criação do domínio
- `specs/aula02/`: Next.js, erros da aplicação, APIs, mocks e integração, BDD, qualidade/CI
- `specs/aula03/laboratorio-03.md`: interface, diagnóstico e performance
- `specs/01-CONSTRUIR-CHAT.md`, `02-TESTAR-APLICACAO.md`, `03-AVALIAR-IA.md` e `SPEC_LABORATORIO_04_CHAT.md`: Aula 04
