# SPEC-NEXT-001 — Evolução do laboratório para Next.js

**Versão:** 1.0  
**Etapa:** 01 — Preparação e regressão  
**Pré-requisito:** branch da Aula 01 com domínio bancário e testes unitários funcionais.

## 1. Objetivo e limite da tarefa

Evoluir **o repositório existente**, sem `create-next-app`, para Next.js com App Router, TypeScript estrito e Jest. A fonte de verdade para o domínio continua sendo `specs/transferencia.md` (BANK-SPEC-001). A migração **não autoriza** alterar contratos de `Conta`, `NumeroConta`, `TransferenciaValor` ou `Recibo`.

**Fora de escopo:** formulário React, operações bancárias novas, banco de dados, API de consulta, autenticação, testes E2E, Docker (nesta etapa).

## 2. Estado inicial e invariantes

1. Na branch inicial da Aula 02, `npm test`, `npm run typecheck` e o build **original da Aula 01** devem executar com sucesso. Registre os resultados antes das alterações.
2. Preserve integralmente `specs/transferencia.md`, `tests/domain/**` e os contratos públicos de `src/domain/**` (ou `src/model/**` quando foi a escolha do aluno).
3. **Não** renomeie `src/model` para `src/domain` apenas para reproduzir exemplos deste material.
4. Mantenha `AGENTS.md` da Aula 01 e acrescente as orientações da Aula 02, sem remover as regras anteriores.
5. Use Node.js 24 LTS e npm. Não gere outro projeto nem outro `package.json` em subdiretório.

## 3. Dependências e configuração esperadas

Instalar na raiz:

```bash
npm install next react react-dom
npm install --save-dev @types/react @types/react-dom
```

Continuar utilizando Jest e `@types/jest`; configurar a suíte geral com `next/jest` conforme a documentação oficial. Os testes de `Request` e `Response` rodam em ambiente **Node**, sem navegador. Não é necessário instalar Testing Library nem jsdom nesta aula.

Scripts obrigatórios ao final (adicionar sem apagar scripts úteis):

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage --runInBand",
    "typecheck": "tsc --noEmit"
  }
}
```

> O `build` **muda de significado**: na Aula 01 transpilava via `tsc`; agora produz o build do Next.js. Se o build TypeScript isolado ainda for útil, mantenha-o em outro script, por exemplo `build:ts`, sem conflitar com `noEmit` do Next.

## 4. Arquivos mínimos a criar

```text
src/app/layout.tsx
src/app/page.tsx
jest.config.cjs               # atualizar o existente
next-env.d.ts                 # gerado/ajustado pelo Next
# opcional: next.config.ts somente se houver necessidade concreta
```

`layout.tsx` deve exportar `RootLayout` válido, com `<html>` e `<body>`; `page.tsx` deve mostrar apenas uma mensagem de ambiente pronto. Não crie formulário, componentes bancários nem acesso a dados na página.

O `tsconfig.json` deverá continuar com `strict: true` e oferecer suporte a JSX, resolução de módulos do Next e arquivos de tipo gerados pelo framework. Ajuste apenas o necessário; evite apagar opções úteis sem análise. Garanta que Jest reconheça `.test.ts` na pasta `tests/`, mantenha `testEnvironment: 'node'`, `collectCoverageFrom` para código em `src/**` e ignore `.next`, `node_modules`, `dist` e artefatos de cobertura. Exemplo em `exemplos/jest.config.cjs`.

## 5. Critérios de aceite verificáveis

| ID | Entrada/ação | Resultado esperado |
| --- | --- | --- |
| NEXT-01 | Executar `npm test -- --runInBand` | Todos os testes da Aula 01 continuam passando; quantidade registrada |
| NEXT-02 | Executar `npm run typecheck` | Sem erros de tipo; `strict` permanece habilitado |
| NEXT-03 | Executar `npm run build` | Build Next.js bem-sucedido, sem gerar implementação bancária nova |
| NEXT-04 | Executar `npm run dev` e abrir `/` | Página mínima exibida corretamente |
| NEXT-05 | Inspecionar `src/domain` ou `src/model` e `tests/domain` | Classes, assinaturas e testes existentes preservados |
| NEXT-06 | Inspecionar `package.json` | Scripts requeridos e dependências da migração declarados |

## 6. Procedimento RED/GREEN e parada

Esta é uma etapa de infraestrutura: **não force um RED de negócio**. Faça comparação de regressão *antes/depois*. Registre os comandos, as contagens reais e quaisquer warnings. Se a suíte deixar de passar, investigue a migração em vez de enfraquecer testes antigos.

**Ponto de parada:** depois de `NEXT-01..06`, aguarde o professor autorizar a implementação da API. Não antecipe `/api/transferencias`.
