# Regras de e2e e scripts de verificação (aba Atendimento e e2e)

Conhecimento que vivia em comentários de `e2e/` e `scripts/`. Os cenários são descritos pelos títulos dos testes.

## Usuários do seed nos e2e de Atendimento
Os UUIDs fixos são os do seed: `...3333` é funcionario.financeiro (ANA), `...5555` é funcionario2.financeiro (BETO) e `aaaaaaaa-...` é funcionario.recepcao. Onde vive: e2e/espera-responsavel.e2e.ts:ANA, e2e/encerrar-atendimento.e2e.ts:FUNCIONARIO, e2e/recepcao-cadastra-contato-ura.e2e.ts:RECEPCAO.

## Espera comum e Responsável
A espera comum (sem destinatário), disputada por dois Funcionários, existe só na Recepção; nos demais Setores o Atendimento vai ao Responsável do Cliente ou ao Líder. A espera é do Setor inteiro: os e2e limpam Atendimentos soltos de outras execuções antes de contar. Onde vive: e2e/aba-atendimento.e2e.ts, e2e/espera-responsavel.e2e.ts, e2e/supervisao-atendimento.e2e.ts.

## Hidratação antes de preencher formulário
Preencher antes da hidratação faz o React Hook Form reaplicar os valores iniciais (ou o submit sair nativo no `next dev` frio). Todo e2e usa o `test` de e2e/fixtures.ts, cujo `goto` espera a hidratação, e o login espera o React assumir o form. Onde vive: e2e/fixtures.ts, e2e/support/criar-cliente.ts.

## Rede nunca ociosa no preview da Vercel
No preview a rede nunca fica ociosa (toolbar/telemetria), então esperas de rede usam teto curto, e contextos extras (`browser.newContext()`) são fechados no fim do teste para não manter polling vivo. Onde vive: e2e/fixtures.ts.

## Proteção de deploy da Vercel
O Preview tem Deployment Protection: o setup salva o cookie de bypass, e limpar o storage inteiro o apagaria (limpa-se só a sessão do Supabase). Onde vive: e2e/bypass.setup.ts.

## Dados dos e2e e limpeza
Clientes criados por e2e não são apagados na hora: cada CNPJ é anotado no manifesto e a rodada seguinte apaga só eles, e só no Supabase local; nomes são únicos por execução porque `getByText` estrito falha com nomes repetidos. A chave de serviço usada para preparar dados é a do Supabase local (não é segredo) e o cliente administrativo recusa destino não local. Onde vive: e2e/support/manifesto-de-clientes.ts, e2e/support/global-setup.ts, e2e/support/admin-local.ts, e2e/support/criar-cliente.ts.

## Quem grava estado de sistema
"Enviado", data de envio e quitação de Parcelamento são do sistema (job, sem sessão): os e2e usam a chave de serviço. Onde vive: e2e/editar-cadastro-operacional.e2e.ts, e2e/parcelamentos-cliente.e2e.ts.

## Leitores falsos nos e2e
Leitor de PDF de parcelamento: marcadores `[leitor:falha]` e `[leitor:sem-codigo]`; sem marcador sugere FALSO-123456 e 12 parcelas. Leitor de cartão de ponto e atestado: sempre "Erick Falso" (declaração em 01/09/2026). Convenção: o extrator falso lê sindicato e vigência de duas linhas do texto. Onde vive: e2e/parcelamentos-cliente.e2e.ts, e2e/rh-folha-de-ponto.e2e.ts, e2e/rh-convencao-coletiva.e2e.ts.

## Área de foco do destaque
O anel de destaque tem 4 px + deslocamento de 2 px porque o anel padrão do foco (2 px + 2 px) termina em 4 px. Onde vive: e2e/destaque-alteracao-aviso.e2e.ts.

## Simples Nacional como página principal
Funcionário SN cai direto em /simples-nacional ao logar; o retorno a "/" redireciona para lá. Onde vive: e2e/login.e2e.ts.

## Checkers em scripts/
- check:actions exige Zod em Server Action (arquitetura 3.13 passo 1 e 4.8); a lista de isentas é para quem não recebe entrada do cliente (logout.actions.ts só encerra a sessão). Onde vive: scripts/check-actions.mjs.
- check:design-doc falha se componente novo do diff (ui/, atoms/, molecules/, organisms/) não aparece no DESIGN.md; base = argumento, DESIGN_BASE, origin/develop ou develop; só arquivos adicionados. Onde vive: scripts/check-design-doc.mjs.
- check:naming: pasta define o papel permitido no sufixo (`nome.<papel>.ts`); `*.spec` é unitário/componente e `*.test` integração; vendors do shadcn só kebab-case. Onde vive: scripts/check-naming.mjs.
- check:refs reprova #NN em comentário; vale só `TODO(#NN)` (arquitetura §2); títulos de describe/it e strings não entram; SQL comenta com `--`. Onde vive: scripts/check-refs-ticket.mjs.
