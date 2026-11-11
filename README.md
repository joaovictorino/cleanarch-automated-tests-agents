# Bank Lab

Projeto educacional desenvolvido para demonstração de conceitos.

O projeto simula operações bancárias, como criação de contas, saques, depósitos e transferências entre contas, utilizando **Node.js, TypeScript, Next.js e Jest**.

Seu objetivo é demonstrar práticas de **Test-Driven Development (TDD)**, aplicando o ciclo RED → GREEN → REFACTOR, com apoio de agentes de codificação.

As funcionalidades são implementadas progressivamente, a partir de critérios de aceite e testes automatizados, permitindo explorar regras de negócio, cenários de sucesso, falhas e valores-limite.

O projeto também utiliza `AGENTS.md` para orientar os agentes de IA e especificações em `specs/` para definir os comportamentos esperados.

## Aulas

- **Aula 01** — domínio bancário (`Conta`, `NumeroConta`, `TransferenciaValor`, `Recibo`) com testes unitários. Especificações em `specs/aula01/`.
- **Aula 02** — Next.js como adaptador HTTP, APIs de contas e transferência, testes de contrato e integração, BDD com Cucumber, CI, cobertura, mutação e análise estática. Especificações na raiz de `specs/`.

## Tecnologias

- Node.js 24 e npm
- TypeScript (strict)
- Next.js (App Router) e React
- Jest (hoje com `ts-jest`; migração para `next/jest` prevista em `specs/criacao-nextjs.md`)
- Cucumber.js com `tsx` (CommonJS)
- Stryker (mutação), SonarQube (via Docker) e GitHub Actions
- Agentes de codificação

## Estrutura

```text
.
├── AGENTS.md                    # instruções para os agentes de IA
├── src/
│   └── domain/                  # Conta, NumeroConta, TransferenciaValor, Recibo
├── tests/
│   └── domain/                  # testes unitários do domínio
├── specs/
│   ├── aula01/                  # criacao.md, transferencia.md
│   ├── criacao-nextjs.md        # preparação do Next.js e regressão
│   ├── erros-aplicacao.md       # ErroNegocio e códigos estáveis
│   ├── api-contas.md            # API de contas
│   ├── testes-contas.md         # testes das contas
│   ├── api-transferencias.md    # API de transferência
│   ├── mocks-e-integracao.md    # mocks HTTP e integração real
│   ├── bdd-cucumber.md          # BDD executável
│   ├── transferencias.feature   # seis cenários obrigatórios
│   └── qualidade-ci.md          # CI, cobertura, Stryker e SonarQube
├── scripts/
│   └── verificar-bdd.cjs        # exige os cenários @bdd-01..06 aprovados
├── .github/workflows/ci.yml     # typecheck + Jest com cobertura
├── cucumber.cjs                 # configuração do Cucumber.js (features/**)
├── jest.config.cjs              # Jest principal
├── jest.domain.config.cjs       # Jest com ts-jest, usado pelo Stryker
├── stryker.config.json          # mutação sobre src/domain/Conta.ts
├── sonar-project.properties     # análise SonarQube
├── docker-compose.yml           # SonarQube e scanner (profile `scan`)
├── next.config.ts
├── tsconfig.json
└── tsconfig.build.json          # build apenas de src/domain e tests para dist/
```

Diretórios gerados e ignorados pelo Git: `coverage/`, `reports/` (Cucumber e mutação), `evidencias/`, `playwright-report/`, `test-results/`, `dist/`, `.next/`.

### Camadas previstas nas specs

Ainda não implementadas neste estado do repositório; as specs definem os contratos:

| Camada | Diretório | Responsabilidade |
| --- | --- | --- |
| Domínio | `src/domain` | regras bancárias e `ErroNegocio` |
| Aplicação | `src/application` | adaptador entre API e domínio |
| API | `src/api` | handlers HTTP testáveis sem servidor; validam só o transporte e traduzem erros classificados |
| App | `src/app` | Next.js: página mínima e rotas `/api/contas` e `/api/transferencias` |
| BDD | `features/` | `.feature`, `step-definitions/` e `support/` do Cucumber |

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
| `npm run test:coverage` | Jest com cobertura (`coverage/lcov.info`) |
| `npm run typecheck` | Verificação de tipos (`tsc --noEmit`) |
| `npm run build:ts` | Transpila apenas `src/domain` e `tests` para `dist/` |
| `npm run test:bdd` | Cenários Cucumber |
| `npm run test:bdd:dry` | Cucumber em dry-run (valida steps sem executar) |
| `npm run test:bdd:full` | Cucumber seguido de `scripts/verificar-bdd.cjs` |

### Qualidade

```bash
docker compose up -d sonarqube                   # SonarQube em http://localhost:9000
docker compose --profile scan run --rm scanner   # envia a análise (requer SONAR_TOKEN no .env)
```

O token fica em `.env`, fora do Git. O CI (`.github/workflows/ci.yml`) executa `typecheck` e `test:coverage` e publica `coverage/` e os relatórios do Cucumber como artefatos.

## Contrato da API de transferências

Definido em `specs/api-transferencias.md`. Erros retornam `{"erro":"<CODIGO>"}`, com códigos estáveis descritos em `specs/erros-aplicacao.md`. O estado das contas é um `Map` em memória, compartilhado apenas dentro do mesmo processo: não há persistência, concorrência nem transação distribuída.
