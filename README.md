# Bank Lab

Projeto educacional desenvolvido para demonstração de conceitos.

O projeto simula operações bancárias, como criação de contas, saques, depósitos e transferências entre contas, utilizando **Node.js, TypeScript e Jest**.

Seu objetivo é demonstrar práticas de **Test-Driven Development (TDD)**, aplicando o ciclo RED → GREEN → REFACTOR, com apoio de agentes de codificação.

As funcionalidades são implementadas progressivamente, a partir de critérios de aceite e testes automatizados, permitindo explorar regras de negócio, cenários de sucesso, falhas e valores-limite.

O projeto também utiliza `AGENTS.md` para orientar os agentes de IA e especificações em `specs/` para definir os comportamentos esperados.

## Tecnologias

- Node.js 24 LTS
- TypeScript (strict mode)
- Jest e ts-jest
- npm
- Agentes de codificação

## Estrutura do projeto

```text
.
├── AGENTS.md               # Instruções e restrições para os agentes de codificação
├── README.md
└── specs/
    ├── criacao.md          # Prompt de preparação do ambiente (configuração inicial do projeto)
    └── transferencia.md    # Especificação funcional (BANK-SPEC-001) — fonte de verdade
```

Os diretórios `src/` e `tests/` são criados gradualmente durante as aulas, conforme as funcionalidades são implementadas (veja a arquitetura prevista em `AGENTS.md`):

```text
src/
└── domain/
    ├── Conta.ts
    ├── NumeroConta.ts
    ├── TransferenciaValor.ts
    ├── Recibo.ts
    └── ErroNegocio.ts

tests/
└── domain/
    ├── Conta.test.ts
    ├── NumeroConta.test.ts
    └── TransferenciaValor.test.ts
```

### Documentos

| Arquivo | Finalidade |
| --- | --- |
| `AGENTS.md` | Contexto, regras de implementação, padrão de testes e formato de resposta dos agentes |
| `specs/criacao.md` | Define a configuração inicial: Node.js, TypeScript, Jest, ts-jest e scripts do npm |
| `specs/transferencia.md` | Regras de negócio e critérios de aceite de saque, depósito e transferência |

## Executando

Após a configuração inicial do projeto (`specs/criacao.md`), que gera o `package.json`:

```bash
npm install
npm test
```

Demais scripts previstos: `npm run test:watch`, `npm run test:coverage` e `npm run typecheck`.
