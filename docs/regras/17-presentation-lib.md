# Regras: presentation/lib, shared e test-support

Conhecimento que vivia em comentários, agora num lugar só. Cada tema aponta onde a regra vive no código.

## Falha de transporte numa Server Action
Só `TypeError` (o fetch que não saiu) é falha de rede; o resto é erro do servidor (arquitetura.md §3.8).
Onde vive: src/presentation/lib/mensagem-da-falha.ts

## Miniatura e recorte de imagem no navegador
A miniatura WebP (lado maior = `lado`, sem ampliar) é o que a conversa mostra; o original (até 10 MB) só baixa quando o Funcionário amplia. O recorte quadrado regrava no canvas, então o EXIF (local, data, aparelho) não sai; `from-image` aplica a orientação do EXIF antes. A miniatura devolve null se o navegador não decodifica; o recorte lança, e quem chama avisa o usuário.
Onde vive: src/presentation/lib/miniatura-de-imagem.ts, src/presentation/lib/recortar-quadrado.ts

## Aviso sonoro
Dois tons gerados pelo navegador, sem arquivo de áudio. Navegadores só liberam som depois de um gesto do usuário (autoplay): `prepararSom` cria o contexto no primeiro clique/tecla; antes disso `tocarNotificacao` é silencioso e nunca lança, nem sem áudio no ambiente.
Onde vive: src/presentation/lib/notificacao-sonora.ts

## Prévia de Word e Excel
Lida no navegador, sem enviar o arquivo a serviço externo. O resultado é só dado; quem desenha o HTML o isola (iframe sem script) porque o arquivo vem do cliente. O navegador usa o build `mammoth.browser`.
Onde vive: src/presentation/lib/previa-de-office.ts

## Superfície de painel e moldura do cartão
Casco visual comum dos painéis nativos sobre véu (DESIGN.md, Superfície de painel nativo); tamanho, rolagem e mecanismo ficam com cada painel. A moldura do cartão de formulário é a da edição do cadastro operacional.
Onde vive: src/presentation/lib/superficie-de-painel.ts, src/presentation/lib/moldura-do-cartao.ts

## Máscara de telefone
Só exibição, sem contraparte de normalização no domínio (telefone só tem presença obrigatória). O telefone do Atendimento vem com DDI; a máscara é DDD + número.
Onde vive: src/presentation/lib/telefone-mask.ts

## Tema
Light é o padrão do produto; `enableSystem` fica desligado para não sobrepor a decisão com a preferência de SO (arquitetura.md §5.2).
Onde vive: src/presentation/providers/theme.provider.tsx

## Logout e guard de sessão
Falha de encerramento não finge logout (não redireciona ao /login se a sessão pode continuar válida); por isso a assinatura (estado, FormData) do useActionState. `shell.server` não tipa o retorno para não importar DTO de módulo (Anexo A); a navegação já vem filtrada por RBAC e só exibe. Guard: sem sessão vai ao login, com senha provisória a troca tem prioridade; `validarSessao(sessao)` para páginas que carregam a sessão em paralelo, `exigirSessao()` nas demais.
Onde vive: src/presentation/view-models/shell/logout.actions.ts, shell.server.ts

## Voltar ao histórico
Só volta no histórico quando o referrer é da mesma origem; favorito/link externo segue o link para o início (também o destino sem JS). Ctrl/Cmd/Shift/Alt-clique e botão do meio ficam com o navegador.
Onde vive: src/presentation/view-models/shell/voltar-ao-historico.container.tsx

## Erros compartilhados
EstadoInconsistenteError: falha da compensação (rollback) precisa ser distinguível; `referenciaId` aponta o recurso a reconciliar. ResultadoIncertoError: falha de transporte, a transação pode ter confirmado: reconciliar antes de compensar. ServicoExternoError: falha esperada de terceiro (ex.: Serpro), não derruba o sistema. GeracaoDeDocumentoError: falha esperada ao montar PDF, vira mensagem.
Onde vive: src/shared/errors/*.error.ts

## Anexo (WhatsApp)
Tipo por MIME, nunca por extensão; lista fechada (SVG e HTML ficam de fora). O limite de tamanho é `serverActions.bodySizeLimit`; a legenda de mídia do WhatsApp tem 1024. Áudio gravado não entra em `ANEXO_MIMES_ACEITOS`; a Meta aceita ogg/Opus e mp4/AAC, não webm (webm é convertido no formulário de gravação); Ogg Opus vs Vorbis se distingue pelo cabeçalho ("OpusHead"/"vorbis"), não pelo MIME. Mídia recebida usa a mesma lista mais áudio. A abertura (navegador, docx/xlsx, só baixar) vai pela extensão só para oferecer a ação; o arquivo é sempre conferido por MIME ao entrar.
Onde vive: src/shared/kernel/anexo.ts

## Avatar
Servido pela rota autenticada `/api/avatar` só ao próprio usuário (ADR 0012); `?v=` é o instante da gravação e invalida o cache. Cadeia: foto, logo do Setor, logo do escritório.
Onde vive: src/shared/kernel/avatar.ts

## CNPJ alfanumérico
Aceita o numérico legado e o alfanumérico vigente desde jul/2026: 12 posições [0-9A-Z] mais 2 dígitos verificadores; cada caractere vale ASCII - 48; pesos e módulo 11 iguais. Forma canônica sem pontuação, maiúscula, sem descartar letras.
Onde vive: src/shared/kernel/cnpj.ts

## Tentativas
Só falha do serviço externo é transitória; sem autorização ou destinatário inválido não melhora ao repetir.
Onde vive: src/shared/kernel/com-tentativas.ts

## Datas e mês de negócio
Fuso de negócio America/Sao_Paulo para todo hoje/mês/horário; UTC erraria o mês entre 21h e 23h59 do último dia. Formatos: "AAAA-MM", "AAAA-MM-DD", "AAAAMM" (provedor fiscal).
Onde vive: src/shared/kernel/mes-atual.ts, data-iso.ts

## Dias do job de parcelamento
O job envia a guia nos dias definidos aqui; é fonte única para o job e para o dashboard. O atraso começa no dia seguinte à última rodada (29); em fevereiro comum, no último dia do mês.
Onde vive: src/shared/kernel/dias-do-job-parcelamento.ts

## Logos por Setor
Arquivos estáticos em `public/logos/` (256x256). A do escritório vale para o Admin e para Setor sem logo; setor novo entra no mapa e o spec confere os arquivos. Tipagem `string` porque o Setor chega da sessão como texto. O Admin não tem Setor: o da sessão é ignorado para ele.
Onde vive: src/shared/kernel/escopo-do-usuario.ts

## Forma de envio e canais
Lista compartilhada entre domain (clientes) e Views globais, sem cruzar a fronteira do módulo (arquitetura.md §3.4). Só com os dois canais o Setor escolhe por onde enviar.
Onde vive: src/shared/kernel/forma-envio.ts

## Foto do ponto
Tipo e tamanho declarados pelo navegador não são confiáveis; a assinatura (primeiros bytes) decide, e só JPEG/PNG seguem para o leitor pago. Limite de 4 MB pelo corpo de Server Action na Vercel (ADR 0007).
Onde vive: src/shared/kernel/foto-do-ponto.ts

## Href seguro
Só caminho relativo do próprio site; nunca repassar query direto ao href (open redirect: "//evil.com", "https://evil.com").
Onde vive: src/shared/kernel/href-seguro.ts

## Número da alteração contratual
Obrigatório, inteiro > 0, único por Cliente, até 9 dígitos no prefixo do arquivo (acima estoura o inteiro do banco). Mesma regra no formulário, schema e domínio. Alerta (não bloqueia): nº menor com data posterior.
Onde vive: src/shared/kernel/numero-alteracao.ts

## Regras compartilhadas entre presentation global e módulos
Presentation global não importa de módulos (arquitetura.md §3.4): papéis, setores, regimes, opções e forma de envio vivem em shared/kernel para não divergir.
Onde vive: src/shared/kernel/opcoes.ts, papeis.ts, setores.ts, regimes.ts

## Paginação por cursor
O PostgREST corta a resposta em `max_rows` (supabase/config.toml), inclusive em funções. As RPCs dos jobs paginam por `cliente_id` (cursor = último da página anterior, estável mesmo se o job tira Clientes do conjunto); página abaixo do `max_rows`. `null` de uma página é falha: devolve null, nunca lista parcial.
Onde vive: src/shared/kernel/paginacao-por-cursor.ts

## Quem pode o quê (papéis)
Permissões por Papel e Setor: edição do cadastro operacional SN (Admin; Líder/Funcionário do SN, Funcionário só dos Clientes de que é Responsável, por RLS); Parcelamentos por Setor; PDF do acordo e guias (SN e RH); dashboard do Setor (Admin ou perfil do Setor); cadastro do RH (RH e Admin); atribuição de Responsável (Líder de cada Setor; Recepção não tem Responsável); carteira inteira (Admin e Líder); comparativo por Responsável (só Líder); anexar alteração contratual (só Admin, dado jurídico); acompanhamento mensal do RH (Admin e RH leem; Funcionário do RH marca; Líder do RH mantém serviços); gráfico de funcionários do RH e Convenção coletiva (Líder do RH e Admin; Responsável do RH lê as regras aplicadas). A RLS repete as regras por Cliente.
Onde vive: src/shared/kernel/papeis.ts

## Regimes
Todo Cliente cadastrado é Simples Nacional nesta rodada, mas o campo aceita os quatro valores (CONTEXT.md, Regime). Cadastro operacional SN só existe para certos Regimes; o banco repete a regra.
Onde vive: src/shared/kernel/regimes.ts

## Regras da Convenção coletiva
Esquema fechado: o modelo de linguagem não cria regra fora dele; o que não couber vira "não aplicada" e vale a legislação. Minutos ou percentual; datas "DD/MM" (nulo para data móvel como Carnaval). Só as chaves lidas por `regrasDeCalculo` mudam a Totalização (um teste do serviço trava a lista). `versao` é a do esquema. `piso`: percentual abaixo é rejeitado.
Onde vive: src/shared/kernel/regras-da-convencao.ts

## Setores
Organograma real, exceto Patriki e Expedição; Zeladoria é subtime de Financeiro; Contábil Externo = Contábil; T.I. cai em Administrativo (CONTEXT.md, Setor). O enum `setor_slug` do Postgres acompanha a lista (migration 20260924190000_usuarios_e_auditoria.sql). Mapas indexados por `string` de propósito: o slug chega cru de DTO/sessão e a exaustividade já vem de SETORES.
Onde vive: src/shared/kernel/setores.ts

## Telefone do Contato
Só dígitos, sem DDI 55, DDD + número (10 ou 11); mesma regra do banco (`chave_telefone`, `contato_validar`). O DDD só é cobrado do número novo ou trocado, para o contato de outro Setor não travar o Salvar. Mesma chave = mesmo número.
Onde vive: src/shared/kernel/telefone.ts

## Texto e reação
Reação: contagem como o WhatsApp (por ponto de código); limite em UTF-16; só impede que texto comum vire reação, a UI oferece a lista. Limites de texto curto e de nome de PDF espelham o CHECK de rh_convencoes.arquivo_nome.
Onde vive: src/shared/kernel/texto.ts

## ActionResult
Converte Result preservando `fields` quando o erro é ValidationError, para apontar o campo inválido.
Onde vive: src/shared/kernel/to-action-result.ts

## Suporte de testes de integração e e2e
Client service_role validado ANTES de existir: URL remota, inválida ou fora do loopback não chega a I/O administrativo. Limpeza apaga só os CNPJs registrados pela suíte, nunca por filtro de nome; Eventos de auditoria (alvo = CNPJ ou "CNPJ - alteração nº N") não caem em cascata e são apagados por prefixo. Com `BASE_URL` só o projeto de homologação declarado em `refHomolog` é aceito. O selo do sino para em "99+": e2e parte de backlog de Avisos pequeno (`zerarAvisos`). Atendimento com dono: a assunção não tem caso de uso ainda, o teste grava o dono direto na tabela. DTOs de cadastro de teste ficam num lugar só (dados fictícios, LGPD).
Onde vive: test-support/admin-supabase-local.ts, exigir-supabase-local.ts, clientes-de-teste.ts, limpeza-e2e.ts, atendimento-com-dono.ts, cadastro-de-teste.ts
