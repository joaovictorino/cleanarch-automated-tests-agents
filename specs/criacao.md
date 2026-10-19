# Preparação do ambiente para laboratório de TDD

Você é um engenheiro de software especializado em Node.js, TypeScript e testes automatizados.

Configure a estrutura inicial de um projeto para um laboratório de Test-Driven Development (TDD) em um MBA de Engenharia de Software.

## 1. Tecnologias

Utilize:

- Node.js 24 LTS
- npm
- TypeScript com strict mode
- Jest
- ts-jest
- @types/jest
- @types/node

Inicialize o projeto com npm e instale todas as dependências necessárias.

## 2. Estrutura do projeto

Crie a seguinte estrutura:

```text
bank-tdd-lab/
├── src/
│   └── domain/
├── tests/
│   └── domain/
├── specs/
├── AGENTS.md
├── jest.config.cjs
├── tsconfig.json
├── package.json
├── package-lock.json
└── .gitignore
```

Utilize a pasta atual como raiz do projeto, sem criar um diretório adicional.

## 3. Configuração

Configure o TypeScript e o Jest para executar testes escritos em TypeScript.

Adicione os seguintes scripts ao package.json:

- `npm test` — executar todos os testes.
- `npm run test:watch` — executar testes em modo de observação.
- `npm run test:coverage` — executar testes com cobertura.
- `npm run typecheck` — verificar tipos sem gerar arquivos.
- `npm run build` — transpilar o TypeScript.

Configure o .gitignore para ignorar node_modules, dist, coverage e arquivos temporários.

## 4. Preparação para TDD

Crie um teste inicial em:

`tests/domain/ambiente.test.ts`

O teste deve apenas verificar que o Jest está funcionando corretamente, utilizando uma asserção simples.

Não crie ainda classes, funções ou regras de negócio.

Não implemente Conta, NumeroConta, Saque, Deposito, TransferenciaValor ou Recibo.

Esses componentes serão desenvolvidos durante a demonstração prática de TDD.

## 5. AGENTS.md

Crie um AGENTS.md com as seguintes orientações:

- Utilizar TypeScript e Jest.
- Escrever testes seguindo Arrange–Act–Assert.
- Seguir o ciclo RED → GREEN → REFACTOR.
- Não implementar funcionalidades sem solicitação explícita.
- Não modificar testes apenas para fazê-los passar.
- Priorizar simplicidade, testabilidade e legibilidade.
- Não adicionar banco de dados, APIs, frameworks web ou infraestrutura externa.
- Executar os testes após alterações.
- Aguardar instruções antes de iniciar qualquer implementação de domínio.

## 6. Validação

Depois de configurar o projeto:

1. Execute npm install.
2. Execute npm test.
3. Execute npm run typecheck.
4. Execute npm run build.
5. Confirme que todos os comandos foram concluídos com sucesso.
6. Apresente a árvore dos arquivos criados.

## Restrições importantes

Esta tarefa é exclusivamente de preparação do ambiente.

**Não desenvolva nenhuma regra de negócio. Não crie testes de saque, depósito ou transferência. Não antecipe as próximas etapas do laboratório.**

Ao finalizar, informe que o ambiente está pronto e aguarde minhas próximas instruções para iniciar o primeiro ciclo de TDD.
