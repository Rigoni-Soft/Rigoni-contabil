# Regras de presentation (components, pages, templates, ui, lib)

Conhecimento que vivia em comentários nos arquivos de `src/presentation/components/{organisms,pages,templates,ui}` e `src/presentation/lib`.

## View global não importa módulos
Os tipos de formulário da View espelham o shape do módulo por estrutura, não por import (arquitetura.md §3.4); o Container, dentro do módulo, garante a compatibilidade. Views são burras: sem hooks, listas de campos, estado e refs vêm do Container (arquitetura.md §4.6).
Onde vive: organisms/editar-cadastro-operacional-form.component.tsx:EditarCadastroOperacionalFormValues; lib/fatia-de-grafico.ts.

## Foco do teclado depois da ação (DESIGN.md)
Botão ocupado usa `aria-disabled` (não `disabled`) para o navegador não soltar o foco; a classe apaga e desliga o clique. Ao cancelar/concluir, o foco vai ao botão que volta ou ao aviso. Cada diálogo/painel tem destino de foco explícito (título do painel do cliente, lista ao fechar conversa, botão Remover ao cancelar confirmação).
Onde vive: lib/botao-ocupado.ts; organisms/painel-de-encerramento, visualizar-documento-contratual, painel-de-contato-ura, guias-da-parcela-pgfn.

## Hidratação do formulário de cadastro
Os campos não controlados não têm valor até hidratar; o HTML do servidor mostraria placeholders. O formulário fica `oculto` (sem sair do layout) e é revelado após 3 s se a hidratação falhar.
Onde vive: organisms/editar-cadastro-operacional-form.component.tsx e editar-cadastro-rh-form.component.tsx: prop `oculto`.

## Login não oferece a credencial salva
No login, o e-mail usa `autoComplete="off"` e a senha `autoComplete="new-password"`: o gerenciador de senhas do navegador não preenche a credencial salva, e quem sai e volta não a vê exposta. O Container limpa o formulário no `pageshow` com `persisted`, para o Voltar não trazer o que foi digitado. Não troque por `email` e `current-password` sem validar na homolog com um Chrome que tenha a senha salva. A troca de senha já usa `new-password`.
Onde vive: organisms/login-form.component.tsx e modules/usuarios/presentation/view-models/login/login.container.tsx.

## Cancelar do formulário inline
Sem `onCancelar` (uso em /clientes/[id]) "Cancelar" navega ao destino do "Voltar". Com callback (busca inline do dashboard, já em "/"), um Link não navega nem reseta; o Container fecha o painel.
Onde vive: organisms/editar-cadastro-operacional-form.component.tsx:onCancelar.

## Parcelamentos e guias PGFN
Parcelamento interno: a guia vai ao financeiro do escritório, nunca ao Cliente. A guia com registro de envio só pode ser aberta. Guia anexada "a confirmar" (leitor do PDF) não é sucesso nem erro. A região de guias fica dentro do form do cadastro: nada ali é `<form>`, só `button` e Server Action própria. Salvar fica bloqueado enquanto algum PDF é lido. CNPJ lido do PDF de outra empresa gera alerta sem bloquear. Seletor de mês ausente (Firefox desktop) cai em texto livre com formato no placeholder.
Onde vive: organisms/guias-da-parcela-pgfn.component.tsx; organisms/parcelamentos-do-cadastro.component.tsx:motivoDeLeituraEmAndamento e quitadoOuPgfnCadastrado (linha que o servidor ignora na edição).

## Leitura de cartão e de atestado
Cartão: a foto de uma quinzena vira o cartão do empregado sem confirmação; o Funcionário corrige à mão; falha de leitura não bloqueia, o erro manda digitar. Atestado: modal (`<dialog>` via showModal); sucesso fecha e atualiza o cartão, erro mantém a modal com o motivo. Erro de falta/tamanho da foto vai no campo; os demais são da leitura.
Onde vive: organisms/leitura-de-cartao.component.tsx; organisms/leitura-de-atestado.component.tsx.

## Convenção coletiva
Envio só do PDF: sindicato, vigência e regras saem dele na leitura única do envio; as regras valem sem aprovação. Histórico: vigência mais recente primeiro, anteriores guardadas, a em tela leva `aria-current`.
Onde vive: organisms/envio-de-convencao.component.tsx; organisms/historico-de-convencoes.component.tsx.

## Documento contratual
Mostra o documento em destaque (alteração de maior nº, ou a do aviso por onde se chegou) com "Abrir em nova aba"; a tela nunca conhece o caminho do arquivo. Só o Admin anexa. O nome acessível começa pelo texto visível (WCAG 2.5.3). O anel de foco usa `focus:` (cobre foco por script após clique de mouse) mais `focus-visible:ring-4`. Base de 12rem no botão evita espremer o rótulo no celular.
Onde vive: organisms/visualizar-documento-contratual.component.tsx.

## Abrir em nova aba
A aba abre síncrona no clique (senão o bloqueador de pop-up barra) e recebe a URL quando a Server Action responde; `opener = null` no lugar de `noopener` para guardar a referência; se a action rejeitar, a aba fecha e o erro segue. Aba barrada devolve `bloqueada` com a URL para oferecer na tela.
Onde vive: lib/abrir-em-nova-aba.ts:abrirEmNovaAba.

## Download base64
Revogar a URL do Blob na mesma volta do `click()` faz alguns navegadores cancelarem o download; a revogação é adiada.
Onde vive: lib/baixar-arquivo-base64.ts:revogarDepoisDoClique.

## Atendimento (lista, chat, ações)
Só o Admin escolhe o Setor. Em tela estreita o chat aberto ocupa o lugar da lista e as ações ficam depois do campo de resposta, com atalho "Ir para as ações" no topo. Líder e Admin veem os Atendimentos dos outros em leitura de supervisão. Cliente novo na espera é anunciado ao leitor de tela (o som é o único outro sinal). A lista de mensagens usa rolador `col-reverse` (nasce no fim, sem JS), `role="log"`; o erro de reação fica fora do rolador. Encerrar pede confirmação e o foco vai à saída segura.
Onde vive: organisms/lista-de-atendimento, lista-de-mensagens, painel-do-chat, painel-de-acoes, painel-de-encerramento, painel-de-em-atendimento, painel-de-espera; templates/atendimento-template.component.tsx.

## Contato da URA
Dois passos: o CNPJ da URA é só sugestão, a Recepção confirma o Cliente e depois informa nome e e-mail. O campo só aponta (`aria-describedby`) para o erro que é dele.
Onde vive: organisms/painel-de-contato-ura.component.tsx.

## Guias e CND no painel de serviços
Guias e CND vêm do provedor fiscal, não da lista do Cliente: o `valor` é o tipo da guia.
Onde vive: organisms/painel-de-servicos.component.tsx.

## Dashboard do RH
O dashboard do RH é o do SN com os dados do RH: o acompanhamento do mês abre a tela, antes do Parcelamento; se a leitura dele falhou, segue só com o que há. Escala de cor única entre anel do card e comparativo; `em_dia` e `andamento` compartilham a tinta (DESIGN.md); a cor nunca é o único canal.
Onde vive: lib/juntar-resumo-rh.ts; lib/cor-de-status.ts.

## Cadastro do RH e do Admin
O RH usa o desenho do cadastro operacional, com observações gerais do RH e contatos; o que é do SN não aparece. O Admin vê SN e RH em dois cartões; o RH não entra no `<form>` do SN (form aninhado) e salva à parte. Líder fora do SN vê o Responsável do Cliente no Setor dele. A confirmação de anexar alteração contratual fica colada ao cartão do documento.
Onde vive: organisms/editar-cadastro-rh-form.component.tsx; organisms/observacoes-do-rh; pages/editar-cadastro-operacional.page.tsx.

## Larguras de tela e templates
Largura relativa por categoria (DESIGN.md → Layout): cadastro (colunas, sem esticar campos), ampla (tabela larga com teto em monitor muito largo). Header e nav ficam fora do `<main>`. Templates e a tela de entrada são sempre Server; o atendimento rola por dentro em tela larga e empilha abaixo de xl.
Onde vive: templates/tela-de-trabalho-template.component.tsx:LARGURA; templates/atendimento-template.component.tsx.

## Primitivas ui
PasswordInput: rótulo fixo "Mostrar caracteres" com `aria-pressed`, sem a palavra "senha" porque os e2e usam `getByLabel("Senha")` (substring); `[&::-ms-reveal]:hidden` esconde o olho do Edge. ThemeToggle: antes do mount assume light e usa `suppressHydrationWarning` só no frame em que o tema salvo diverge; sem isso o mismatch refaz a árvore e apaga o que o usuário digitou. MenuSuspenso: `<details>` nativo; fechar ao clicar fora exigiria popover com posição própria. BotaoDoMenu: popover nativo; o botão só espelha o estado em `aria-expanded` pelo evento `toggle`.
Onde vive: ui/password-input.tsx; ui/theme-toggle.tsx; ui/menu-suspenso.tsx; ui/botao-do-menu.tsx.

## Utilitários de lib
`accept-documento`: dica do seletor (PDF, DOCX, DOC legado); a validação real é o schema Zod. `cnpj-mask`: máscara só visual, preserva letras (CNPJ alfanumérico); valida `cnpjValido`. `descricao-do-campo`: junta o describedby externo, a ajuda e o erro; vazio vira `undefined`.
Onde vive: lib/accept-documento.ts; lib/cnpj-mask.ts; lib/descricao-do-campo.ts.
