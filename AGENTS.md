## 1. Contexto do projeto

Este projeto é um laboratório educacional de engenharia de testes automatizados e desenvolvimento assistido por agentes de codificação.

O domínio é uma aplicação bancária simplificada, com operações de saque, depósito e transferência entre contas.

O objetivo principal não é construir um sistema bancário de produção, mas demonstrar:

- Desenvolvimento orientado por testes (TDD).
- Desenvolvimento orientado por especificações.
- Automação de testes com Jest.
- Código testável e separação de responsabilidades.
- Revisão crítica de código e testes produzidos por IA.

## 2. Fonte de verdade

A especificação funcional está em:

`specs/transferencia.md`

Todas as regras de negócio devem ser derivadas dessa especificação.

Não invente novas regras de negócio sem declarar a suposição e solicitar validação.

Não modifique critérios de aceite para acomodar limitações da implementação.

Um teste passando não é prova de que o requisito está correto.

## 3. Tecnologias

Utilize:

- Node.js 24 LTS.
- TypeScript com strict mode.
- Jest como framework de testes.
- ts-jest para executar testes TypeScript.
- npm para gerenciar dependências.

Não introduza outras tecnologias sem necessidade explícita.

## 4. Arquitetura

Priorize uma organização simples:

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

Crie os arquivos gradualmente, conforme as funcionalidades forem implementadas.

Evite abstrações e camadas sem uma necessidade demonstrável.

Não implemente nesta aula:

- API HTTP.
- Banco de dados.
- ORM.
- Autenticação.
- Interfaces gráficas.
- Serviços externos.
- Docker ou Kubernetes.

A persistência e os serviços de aplicação serão tratados posteriormente.

## 5. Contratos públicos

Mantenha os contratos estabelecidos pela especificação.

Os componentes previstos são:

- `Conta`: representa conta, saldo, saque e depósito.
- `NumeroConta`: valida o identificador de seis dígitos.
- `TransferenciaValor`: executa a transferência entre duas contas.
- `Recibo`: representa o comprovante da operação.
- `ErroNegocio`: representa uma violação das regras do domínio, quando necessário.

## 6. Regras de implementação

- Priorize legibilidade e simplicidade.
- Utilize tipagem explícita nos contratos públicos.
- Evite `any`.
- Evite estados globais mutáveis.
- Evite acoplamento com infraestrutura externa.
- Não utilize rede, arquivos ou banco de dados nas regras de domínio.
- Não adicione funcionalidades futuras sem necessidade.
- Não introduza padrões de projeto apenas por preferência.
- Preserve o comportamento existente durante refatorações.
- Mantenha erros de negócio compreensíveis e verificáveis.

## 7. Desenvolvimento orientado por testes

Para cada comportamento novo:

1. Identifique o critério de aceite correspondente.
2. Crie um teste que represente o comportamento esperado.
3. Execute Jest.
4. Confirme a falha do teste — RED.
5. Implemente a menor alteração que satisfaça o teste — GREEN.
6. Execute a suíte novamente.
7. Refatore, se necessário, preservando os testes — REFACTOR.

Não implemente antecipadamente comportamentos que ainda não foram solicitados na etapa atual.

Durante uma demonstração de TDD, aguarde a orientação do professor antes de avançar para novos comportamentos.

## 8. Padrão dos testes

Utilize Jest e o padrão Arrange–Act–Assert:

- Arrange: preparação dos dados.
- Act: execução do comportamento.
- Assert: verificação do resultado.

Escreva nomes de teste que descrevam comportamentos.

Exemplos:

- "deve permitir saque com saldo suficiente".
- "deve rejeitar transferência com saldo insuficiente".
- "deve manter os saldos quando uma transferência falha".

Prefira testes determinísticos, independentes e rápidos.

Os testes devem validar resultados observáveis e regras de negócio.

Evite testes que apenas comprovem que uma função foi chamada, sem verificar seus efeitos.

Utilize `test.each` quando vários casos representarem a mesma regra.

Não utilize snapshots para validar cálculos bancários.

## 9. Cobertura dos cenários

Considere:

- Caminho principal.
- Fluxos alternativos.
- Valores-limite.
- Entradas inválidas.
- Estados anteriores e posteriores.
- Ausência de efeitos colaterais em operações rejeitadas.

Não considere cobertura de linhas equivalente à cobertura dos critérios de aceite.

Não crie testes redundantes apenas para aumentar o percentual de cobertura.

## 10. Testabilidade

Os componentes devem permitir controlar suas entradas e observar seus resultados.

Evite dependências aleatórias ou externas nos testes.

O gerador do número de comprovante deve poder ser substituído por uma função determinística.

Não utilize esperas artificiais, dependências de horário ou recursos externos para testar regras de domínio.

## 11. Restrições dos agentes

Você não deve:

- Apagar testes existentes para fazer a suíte passar.
- Alterar uma asserção apenas porque a implementação falhou.
- Ignorar regras da especificação.
- Declarar testes como aprovados sem executá-los.
- Ocultar erros de compilação.
- Substituir erros de negócio por retornos falsos sem justificativa.
- Reproduzir uma implementação de referência em vez de seguir a especificação.
- Avançar automaticamente para as atividades de outras aulas.

Se encontrar conflito entre os arquivos, informe o conflito ao professor antes de escolher uma interpretação.

## 12. Comandos obrigatórios

O projeto deverá disponibilizar:

```bash
npm test
npm run test:watch
npm run test:coverage
npm run typecheck
```

Execute os comandos relevantes após modificar código ou testes.

Se não conseguir executar algum comando, informe a causa e não declare sucesso.

## 13. Formato da resposta do agente

Ao terminar uma tarefa, informe:

1. O que foi implementado.
2. Os arquivos criados ou modificados.
3. Os testes adicionados.
4. Os comandos executados.
5. O resultado real dos comandos.
6. Os cenários ainda não cobertos.
7. As decisões ou suposições que exigem revisão humana.

Não apresente apenas uma mensagem genérica de conclusão.

## 14. Critério de conclusão

Uma implementação somente poderá ser considerada concluída quando:

- Os critérios de aceite solicitados na etapa estiverem satisfeitos.
- Os testes correspondentes existirem.
- Jest tiver sido executado com sucesso.
- A verificação de tipos estiver passando.
- Não houver alterações indevidas nos testes.
- O agente apresentar evidências dos resultados.

A responsabilidade de aceitar a implementação permanece com o desenvolvedor e com o professor.
