# Sistema de Atendimento e Gestão (Rigoni Contábil)

Domínio de atendimento a clientes (empresas contábeis) via WhatsApp e de gestão interna por setor da Rigoni Contábil, um escritório de contabilidade.

## Language

### Organização e acesso

**Setor**:
Unidade organizacional do escritório (ex.: Simples Nacional, Tributário), com no máximo um Líder de setor ativo (não desativado) por vez — promover outro exige rebaixar o atual antes (#57). Fonte da lista de setores: `organograma.pdf`. Zeladoria é subtime de Financeiro, não é Setor próprio — decisão definitiva, confirmada por Cledson em 25/09/2026. Contábil Externo é o mesmo Setor que Contábil (não dois Setores) e T.I. não é Setor próprio — cai dentro de Administrativo, mesmo padrão da Zeladoria — decisão definitiva, confirmada por Cledson em 28/09/2026.
_Avoid_: Departamento, área.

**Papel**:
O nível de acesso de um usuário logado: Admin, Líder de setor ou Funcionário. Determina o que o usuário pode ver e alterar, restrito ao seu Setor exceto para Admin.
_Avoid_: Role, perfil (como sinônimo de Papel — "perfil" é a tela abaixo).

**Perfil**:
A tela "Meu perfil" (`/perfil`), acessível a qualquer usuário logado, exceto enquanto a troca obrigatória de Senha provisória estiver pendente (que bloqueia qualquer tela): mostra a própria conta (nome, e-mail, Papel, Setor) e permite trocar a própria senha por escolha. Não confundir com Papel nem com a troca obrigatória de Senha provisória (`/trocar-senha`).

**Senha provisória**:
A senha gerada automaticamente quando Admin/Líder cadastra uma conta. Expira em 48h se não trocada; a troca é obrigatória no primeiro login, bloqueando qualquer tela até acontecer. Não elimina o risco de quem autenticar primeiro com ela definir a senha definitiva da conta — ver `docs/adr/0002`.
_Avoid_: Senha temporária, senha padrão.

**Atendente**:
Quem está conduzindo um Atendimento no momento — pode ser a URA ou um Funcionário. Termo genérico usado quando a distinção entre os dois não importa.
_Avoid_: Operador.

**URA**:
Ator de sistema (service role, sem login humano) que conduz o Atendimento automatizado via WhatsApp antes de uma eventual transferência para um Funcionário. Não é um Papel.
_Avoid_: Bot, chatbot.

**Expediente**:
Janela em que a URA atende: dia útil (não sábado, domingo nem feriado), das 8h às 18h, horário de São Paulo. Fora dele a URA só responde um aviso com a volta do escritório — sem menu, documento, sessão nem Atendimento. Atendimento em andamento segue até ser finalizado e continua anexando as Mensagens do número. Feriados nacionais (fixos e móveis) estão no código; estaduais e municipais são cadastrados pelo Admin e auditados.
_Avoid_: Horário comercial, plantão.

### Cliente e cadastro

**Cliente**:
Uma empresa cadastrada no sistema, identificada por CNPJ. "Empresa" é o nome do Cliente, não uma entidade separada.
_Avoid_: Empresa (como entidade à parte), conta.

**Regime**:
O regime tributário do Cliente — Simples Nacional, Lucro Presumido, Lucro Real ou MEI, livremente escolhido no cadastro (#33). Só Simples Nacional e MEI ganham Cadastro operacional (ver termo abaixo); Lucro Presumido e Lucro Real não têm cadastro nesta rodada.
_Avoid_: Regime de atendimento (não é isso).

**Cadastro operacional**:
O conjunto de campos que o Funcionário do Simples Nacional mantém atualizado por Cliente — forma de envio, Contatos, documento recebido, DAS, Atividade do mês, observações gerais (#34) e a lista de Parcelamentos (#122). Nasce automaticamente quando o Cliente é cadastrado com Regime Simples Nacional ou MEI (#33), com os campos de status em suas opções negativa/pendente por padrão (documento recebido = negativo; DAS = pendente; sem Parcelamentos) até o Funcionário atualizar de verdade — nunca fica em branco esperando o primeiro acesso. Outros Setores só visualizam; nunca inclui contrato social/alterações contratuais (estes só se abrem pelo botão de visualização, para Admin, Líder do Simples Nacional e Responsável do Cliente — #140).
_Avoid_: Cadastro do cliente (ambíguo com o cadastro básico do #33 — Empresa/CNPJ/Regime/documentos jurídicos).

**Cadastro do Cliente no RH**:
A tela "Editar cadastro operacional" do RH, a mesma do SN com os dados do RH, em `/clientes/[id]`: empresa e CNPJ (sem o Regime), o Responsável do RH, o acompanhamento do mês, os contatos (de todos os Setores, de qualquer Regime), as **observações gerais do RH** (cada Setor tem as suas e só ele as lê, além do Admin) e o documento contratual em leitura. O que é do SN (DAS, atividade, forma de envio) não aparece. Edita o Responsável do RH do Cliente, o Líder do RH e o Admin (que vê o SN e o RH: na tela completa dele, as observações do RH entram à parte); o status do Holerite é do sistema. Os **Parcelamentos do RH** entram na mesma tela, com o fluxo do SN (código, parcelas restantes, PDF do acordo, guia da parcela e o status do mês) e a mesma leitura do PDF; quem os cadastra, edita e remove é quem edita o cadastro do RH (o Líder e o Responsável do RH, e o Admin pelo banco), de Cliente de qualquer Regime, e o SN e o RH não veem os do outro (#216).

**Responsável**:
O Funcionário atribuído pelo Líder a um Cliente (#65). Um Cliente tem no máximo um Responsável por Setor; a regra é do sistema, comum a todo Setor. Em todo Setor, o Simples Nacional inclusive, ele fica no mesmo lugar (Cliente, Setor, Funcionário do Setor), atribuído pelo Líder do Setor (ADR 0003). Um Cliente tem no máximo um; um Funcionário pode ser Responsável por vários. Funcionário só enxerga os Clientes pelos quais é Responsável, em qualquer Setor (RLS no banco: `pode_ver_cliente`), e só edita o cadastro operacional dos do Simples Nacional; o Líder e o Admin enxergam todos, e o Líder do Setor é o único que atribui, troca ou remove o Responsável daquele Setor. A **Recepção** é a exceção: todos os Funcionários e o Líder respondem por todo cliente que chega, então o Funcionário da Recepção enxerga todos os Clientes e a espera dela é sempre comum. O Responsável é dado exclusivo de cada Setor, nunca do cadastro do Cliente: o Responsável do RH e o do Simples Nacional são independentes. O RH lê o Cliente pela view `clientes_basico` (empresa, CNPJ e Regime), então o cadastro operacional do Simples Nacional não chega ao servidor da página do RH. Cada Setor tem o seu cadastro: o do RH é o **Cadastro do Cliente no RH** (acima) e o do Simples Nacional não é do RH (a RLS ainda não o esconde: o Líder e o Responsável do RH o leem pela API). Sem atribuição, o Cliente aparece como "Sem responsável". Funcionário removido (conta excluída) também deixa o Cliente sem responsável; a desativação (soft delete) nasce no #58, que deve fazer o mesmo.
_Avoid_: Dono, atendente do cliente (Atendente é outro conceito — quem conduz um Atendimento).

**Contato**:
Um vínculo nome + número de WhatsApp a um Cliente. Um Cliente tem um Contato marcado como padrão e pode ter outros Contatos adicionais.
_Avoid_: Cliente (um Contato não é o Cliente, é quem fala em nome dele).

**DAS**:
Documento de Arrecadação do Simples Nacional — a guia de imposto mensal do Cliente, obtida via integração Serpro.
_Avoid_: Guia de imposto (usar DAS quando for especificamente essa guia).

**Parcelamento**:
Acordo de parcelamento de débitos tributários do Cliente junto à Receita, cuja guia também é obtida via Serpro. Um Cliente tem zero, um ou vários, cada um com código, parcelas restantes, a marca "é interno" e o PDF do acordo anexado (obrigatório); "Tem parcelamento" é só o resumo derivado ("Sim (2)"). Quem edita o Cadastro operacional (Funcionário SN Responsável, Líder SN, Admin) cadastra à mão, com mínimo 1 parcela restante, e remove um Parcelamento sem registro de envio (o anexo vai junto). Dois eixos: a **situação** (em aberto → quitado) e o **status do mês** (pendente/enviado, derivado do registro de envio). Cliente sem Parcelamento cadastrado não tem guia a enviar. O PDF fica em bucket privado, só o servidor lê (#122). O Parcelamento PGFN cadastrado só ganha guias mensais: código, origem, "é interno" e restantes não se editam, e a guia anexada troca ou se remove até o envio (#184).

Cada Setor tem os seus Parcelamentos, com o mesmo fluxo, e só vê os seus; o Cliente tem zero, um ou vários por Setor. Quem busca a guia para enviar ao Cliente (URA, job) enxerga os de todos os Setores juntos. Os que já existem pertencem ao Simples Nacional.

**Parcelamento em aberto / quitado**:
Em aberto é o que ainda gera guia; quitado é o marcado como quitado ou com parcelas restantes em zero. Quem decide é o banco: a edição à mão nunca grava zero nem a situação (o zero vem do sistema, ao entregar a última parcela).

**Parcelamento interno**:
Parcelamento pago pelo escritório (marca "é interno"): a guia dele não vai ao Cliente, e sim ao WhatsApp do financeiro (`FINANCEIRO_TELEFONE`), por template próprio e qualquer que seja a forma de envio do Cliente (#127).

**Registro de envio do Parcelamento**:
Uma linha por Parcelamento e parcela (AAAAMM), gravada só pelo sistema quando a guia é entregue; nenhuma sessão de usuário escreve (ADR 0008). É a base do status do mês e trava a remoção do Parcelamento.

**Atividade do mês**:
Registro mensal por Cliente com três marcações independentes (Indústria, Comércio, Serviço), indicando os tipos de nota fiscal emitidos naquele mês — pode mudar mês a mês e não é exclusivo (um Cliente pode ter mais de um tipo marcado no mesmo mês). Usado para determinar o anexo do Simples Nacional aplicável ao cálculo do DAS.
_Avoid_: Regime (é outro conceito — ver acima).

**CND**:
Certidão Negativa de Débitos — documento que atesta a regularidade fiscal do Cliente, obtido via Serpro.

**Aviso de cadastro**:
O registro permanente, por destinatário, de que um Cliente entrou no Cadastro operacional (*novo cliente*) ou ganhou uma alteração contratual (*nova alteração*). O de novo cliente vai ao Líder do Setor Simples Nacional; o de nova alteração vai ao Líder e ao Responsável do Cliente (só ao Líder, se não houver Responsável ativo). O Admin nunca é destinatário e não vê o sino de avisos: só os Setores são avisados. Fica "não visto" até o destinatário abri-lo. Não expira.
_Avoid_: Notificação.

**Alteração contratual**:
Documento que altera o contrato social do Cliente, anexado pelo Admin com a data e um número de sequência (1, 2, 3...) que é único por Cliente. A mais recente é a de maior número.

### Atendimento

**Atendimento**:
A sessão completa de contato entre um Contato e o escritório, do início ao encerramento — pode passar por vários Atendentes e Setores via Transferência. Contém muitas Mensagens. **Começa quando o contato é encaminhado a um humano** (um Setor ou a espera): a conversa com a URA antes disso (saudação, "já é cliente?", CNPJ, menu) não é guardada como Mensagem; quem recebe o Atendimento vê o resumo e o CNPJ informado na URA (#46), não os balões (decisão do usuário, 2026-10-08).
O Atendimento que a URA abre na recepção traz o motivo (resumo) e, se o número informou, o CNPJ: o CNPJ de um Cliente liga o Atendimento a ele; CNPJ que não existe no sistema é um provável cliente novo. Nenhum Contato é salvo.
_Avoid_: Conversa, ticket, chamado.

**Mensagem**:
Uma única troca dentro de um Atendimento (um "balão"), enviada pelo Contato ou por um Atendente.
_Avoid_: Balão (usar só informalmente), texto.

**Encerramento automático**:
O sistema encerra o Atendimento em atendimento (com Funcionário) 23h50 depois da última Mensagem do cliente; a Mensagem do Funcionário não reinicia a contagem. O relógio é corrido (noite, fim de semana e feriado contam) e o job roda também fora do expediente. É o encerramento comum, auditado com o sistema (a URA) como ator; ninguém é avisado. Não reabre: o cliente que volta abre um Atendimento novo pela URA. Atendimento em espera não entra. Substituiu a antiga Inatividade (2 horas, avisos ao cliente e ao Funcionário, encerramento pela URA), que não existe mais.

**Espera** (a antiga Fila):
O estado de um Atendimento aguardando que alguém o assuma — ao abrir, ou depois de uma Transferência. Não é uma entidade separada do Atendimento — é um estado dele, chamado antes de Fila; sem posição numérica. Todo Atendimento novo (a URA o encaminha ao Setor) ou transferido cai na espera do Setor, sem escolha automática de Funcionário: o sistema não distribui, não há fila pessoal e o cliente não recebe posição, só "aguarde, já vamos atendê-lo". A espera é **dirigida** quando o Setor tem destinatário: o Responsável do Cliente naquele Setor ou, sem ele, o Líder do Setor. A **Recepção** é a exceção: todos os Funcionários e o Líder respondem por todo cliente que chega, então a espera dela é a única comum: qualquer Funcionário ou Líder da Recepção a vê e a assume, e o primeiro clique vence. Só o destinatário a vê e a assume; Líder do Setor e Admin a leem em supervisão; os demais usuários, do Setor ou de outros, não sabem dela. Não há espera comum fora da Recepção: sem Responsável nem Líder ativo, o Atendimento fica sem destinatário, só Líder e Admin o leem e ninguém o assume até haver um. O Setor vê quem espera, com o que já foi coletado e o tempo de espera (mm:ss, h:mm:ss a partir de 1h), do mais antigo ao mais novo. Encerrar ou transferir um Atendimento não puxa ninguém da espera. Desativar um usuário devolve à espera do Setor os Atendimentos dele (e os que esperavam dirigidos a ele), com auditoria e sem atribuição. A **assunção** continua gravada como evento imutável, sem efeito na distribuição; a desconexão temporária (#48) segue só mantendo a atribuição.
_Avoid_: Fila (pessoal ou como entidade própria), posição na fila, Fila de espera.

**Transferência**:
A ação de mover um Atendimento de um Atendente/Setor para outro. O dono transfere pelas ações da aba Atendimento: escolhe o Setor de destino (nunca o Setor em que o Atendimento já está) e informa o resumo do assunto. Depois de transferir ele perde o controle e a visão da conversa: a conversa fecha e some da aba "Em atendimento". O Atendimento transferido cai na espera do Setor de destino e o cliente recebe só "aguarde, já vamos atendê-lo".
A regra de destino é do sistema: o Atendimento fica dirigido ao Responsável do Cliente ou, sem Responsável, ao Líder do Setor de destino. Vale em todo Setor de destino, menos a Recepção (espera sempre comum); o Simples Nacional ainda só recebe Cliente do Simples Nacional ou MEI. A URA aplica a mesma regra ao encaminhar o cliente ao Setor pedido. Sem Responsável e sem Líder ativo no Setor, o Atendimento fica sem destinatário (só Líder e Admin o leem). Responsável inativo (usuário desativado, #58) não conta: o Atendimento vai ao Líder.

**Aba Atendimento** (antigo Painel do Funcionário e Dock de Atendimentos):
A tela `/atendimento`, ao lado do Dashboard em todo Setor (#162), com duas abas sobrepostas: "Em espera" (os cards da espera do Setor, do mais antigo ao mais novo, assumidos por clique; o primeiro clique vence e o outro recebe "já assumido") e "Em atendimento" (os Atendimentos do usuário). O chat abre no centro, sem rota própria, com Serviços do cliente, Transferência e Encerrar; o Admin escolhe o Setor. Em tela estreita lista e chat alternam. O card da espera mostra o Contato, a empresa, o resumo do pedido, de onde veio quando foi transferido ("Transferido de Financeiro por Fulano") e o tempo de espera. Um contador de pendentes (a espera do Setor mais os Atendimentos com o cliente aguardando) aparece no menu e na aba (#163); o card com o cliente aguardando é destacado, e a tela toca o aviso sonoro quando surge Atendimento na espera ou o cliente escreve de novo (polling de 15 s). Líder do Setor e Admin, na aba "Em atendimento", leem também os Atendimentos da equipe, e na "Em espera" a espera dirigida, só em leitura: não assumem, respondem nem transferem (#165). O polling de 15 s e o aviso sonoro seguem em toda tela autenticada (um observador sem interface no layout); o contador fica no menu. Não há rota própria para a conversa nem Dock: a aba é o único lugar em que o Funcionário conduz um Atendimento (#168). Na conversa, quem pode abri-la é o dono, o Líder do Setor onde ela está ou o Admin; só o dono responde, envia e transfere, enquanto Líder e Admin ficam em **leitura de supervisão** (veem a conversa, inclusive de outros e da espera dirigida, e podem encerrar). O balão do cliente mostra o nome do Contato cujo número bate com o do Atendimento (o Contato padrão desempata) e o CNPJ da empresa — ou "CNPJ não definido" quando o número não foi identificado ou é cliente novo; o balão do atendente mostra nome e Setor de quem escreveu.
_Avoid_: Fila de espera (como tela), Chat do funcionário, Painel do Funcionário, Dock.

**Serviços do cliente**:
Os mesmos serviços do menu da URA (contrato social, alterações contratuais, guia de imposto, guia de parcelamento, CND) disparados pelo Funcionário com um clique, usando o Cliente já vinculado ao Atendimento, sem perguntar o CNPJ de novo. Cada serviço tem um botão no painel: o contrato social, a alteração (escolhida num seletor, por nº decrescente, identificada pelo nº) e as guias e a CND, buscadas no provedor fiscal como na URA (#42, #66). Guia sem autorização fiscal do Cliente ou provedor fora do ar devolvem o erro ao Funcionário, sem deixar Mensagem no Atendimento (a falha é auditada).

### Jobs e alertas

**Lembrete de documento**:
Mensagem que o sistema envia nos dias 01, 05, 10 e 15 ao Contato padrão dos Clientes com documento obrigatório negativo, pedindo os documentos fiscais do mês (#52). Fora da janela de 24h usa o template aprovado; dentro, o formato próprio do sistema.
_Avoid_: Cobrança.

**Envio automático de DAS**:
Nos mesmos dias, a entrega da guia do DAS quando o DAS está pronto, pela forma de envio do Cliente (WhatsApp, e-mail ou os dois). O DAS só passa a enviado, com a data de envio e auditado com a URA como ator, depois de a entrega ser aceita (a entrega é reservada antes, sem mudar o DAS); se ela falha, o DAS segue pronto (#52). A edição manual do cadastro não define `enviado` nem a data de envio — só o sistema; um DAS já enviado continua exibido e a data some se o status volta a outro valor (#108). A opção do DAS na URA segue o mesmo processo, só muda o gatilho (#124): confere no banco se o DAS está pronto antes de chamar o provedor fiscal; não pronto, avisa que o escritório enviará quando estiver, sem provedor e sem alerta ao setor (só o job abre); pronto e ainda não enviado, o pedido adianta o envio, com a mesma reserva do job, e o DAS passa a enviado com a data e a URA como ator (o job do mês não o reenvia); já enviado, reenvia a guia guardada (cliente/das/AAAAMM do mês do envio) sem chamar o provedor; se o job ou outro pedido já está entregando (reserva ocupada), o Cliente é avisado de que o envio está em andamento. Um DAS enviado antes de a guia passar a ser guardada não tem PDF para reenviar e cai no aviso de guia indisponível.
_Avoid_: Disparo.

**Envio automático de guia de parcelamento**:
Nos dias 20, 22, 24, 26 e 28, a entrega das guias de parcelamento aos Clientes com Parcelamento em aberto sem registro de envio do mês: o comum pela forma de envio do Cliente, o interno ao WhatsApp do financeiro. O banco manda: sem Parcelamento em aberto o provedor fiscal não é chamado. Cada entrega aceita grava o registro de envio da parcela, auditado com a URA como ator, e desconta uma parcela restante (quita ao zerar); a falha de um Parcelamento não trava os outros e a rodada seguinte tenta de novo (#53, #126). Sem telefone do financeiro válido o interno não é enviado e segue pendente (#127). O Parcelamento PGFN entra no mesmo envio com as guias confirmadas à mão, com o PDF do banco (nunca do provedor fiscal), até a competência do mês corrente e da mais antiga para a mais nova; sem guia confirmada o job apenas pula, sem alerta. Na URA, pedido repetido reenvia o mesmo PDF sem novo registro nem desconto, e sem guia confirmada o Cliente recebe "ainda não disponível" (#186).
_Avoid_: Disparo.

**Alerta do setor**:
Registro que o job grava para o Setor dono do Parcelamento (o Simples Nacional, nos demais casos) quando algo pede ação humana: DAS pendente com o documento em dia (`das_pendente`), envio que falhou depois das tentativas (`falha_envio`), Cliente sem contato ou e-mail para a forma de envio (`contato_ausente`) e guia entregue por um canal só (`entrega_parcial`), Parcelamento pendente que o provedor não entregou ou que não casou com nenhuma guia (`parcelamento_sem_guia`, a mensagem lista os códigos) e telefone do financeiro ausente ou inválido, com Parcelamento interno pendente (`financeiro_ausente`). Há um alerta aberto por Cliente, tipo e Setor (um Cliente com Parcelamento no Simples Nacional e no RH tem um alerta de cada, e cada Setor vê só o dele); o job o renova enquanto a condição existe e o resolve quando ela some, exceto `entrega_parcial`, que só uma pessoa resolve. Cada alerta tem a origem do job que o gerou (`lembretes` ou `parcelamento`): um job renova e resolve só os seus. Limite conhecido (#217): a falha de ler os Parcelamentos do Cliente no provedor ou no banco não tem Setor para atribuir, então o `falha_envio` dela vai ao Simples Nacional e o RH não o vê num Cliente que só tem Parcelamento do RH.
_Avoid_: Notificação.

### RH: acompanhamento e folha de ponto

**Acompanhamento mensal**:
O acompanhamento do RH por Cliente e por competência (mês), no desenho do dashboard do SN: no dashboard do RH cada Serviço do acompanhamento é um card com os Clientes que ainda faltam nele, mais o card "Tudo concluído"; marcar se faz no painel do Cliente. Todo mês nasce com tudo pendente; o histórico dos meses anteriores é consultável no painel do Cliente. Só o Responsável do RH do Cliente marca; o Líder e o Admin leem todos. Os Comparativos do dashboard seguem os do SN: donut "Status do acompanhamento", barras "Status do parcelamento" (contam só os Parcelamentos do RH) e, para Líder e Admin, o card "Clientes por Responsável", que abre o acompanhamento dos funcionários: pontos x Clientes atribuídos de cada um, os Clientes que faltam por Serviço (cada número abre a lista das empresas daquele Serviço) e os Clientes sem Responsável (cada um abre o cadastro operacional); dali se abre o detalhe de cada Funcionário.

**Serviço do acompanhamento**:
Um card do Acompanhamento mensal (ex.: FGTS, DCTFWeb, NUTRI, SIB, Sindicato), marcado como concluído ou não pelo Responsável. A lista é mantida pelo Líder do RH, no menu de configuração (engrenagem) do cabeçalho do Setor. Cada Cliente tem um "se aplica" por Serviço; o que não se aplica não conta. O "não se aplica" vale **só no mês** em que foi marcado (renova-se todo mês: o FGTS que não existe este mês volta a se aplicar no seguinte); "**nunca se aplica**" é a exceção permanente (a célula fica desabilitada, com o botão Reativar), para o Serviço que o ramo do Cliente não tem, e vale em todos os meses. Marcar concluído um Serviço que não se aplica é recusado. Decisões declaradas: o Responsável do RH vale o atual em todo o histórico (trocar o Responsável reatribui os pontos dos meses passados; modelar por competência fica para quando o escritório precisar) e o Responsável pode corrigir meses passados (só mês futuro é barrado). O **Holerite** é o Serviço do sistema: nunca marcado à mão, fica concluído quando todo empregado ativo do Quadro do Cliente tem o Cartão de ponto do mês, excluídos os "sem movimento". Cartão do mês salvo = pelo menos um dia salvo no mês: o cartão incompleto (apontamento em alguns dias) conta como feito; o cartão só iniciado, sem nenhum apontamento, é cartão por fazer (quem não trabalhou o mês todo fica "sem movimento"). Cliente sem empregados (ou só com "sem movimento") não tem Holerite a cumprir: o Serviço aparece como "Não se aplica" e não pesa nos pontos. Decisão declarada: o Holerite de um mês passado é calculado com o Quadro de hoje (o empregado não guarda data de entrada nem de saída), então cadastrar ou inativar um empregado muda o Holerite e os pontos dos meses anteriores; modelar por competência fica para quando o escritório precisar. O painel do Cliente mostra empregados cadastrados x cartões feitos no mês e o card do Holerite no dashboard traz o total do setor, "cartões feitos de exigidos": os cadastrados "sem movimento" ficam fora da conta, como no Serviço (#221).

**Ponto do funcionário**:
O ponto que um Funcionário do RH ganha por Cliente em que todo Serviço aplicável do mês, inclusive o Holerite, está concluído. O detalhe do Funcionário (Líder e Admin), aberto pelo acompanhamento dos funcionários, mostra pontos x Clientes atribuídos e lista os Clientes com algo pendente agrupados pelo Serviço que falta. O Funcionário não o vê.

**Quadro de funcionários do Cliente**:
Os empregados de um Cliente, só com nome e a marca "comissionado" (que define o percentual de hora extra em data especial). A marca nasce do padrão do Cliente ("os empregados deste Cliente são comissionados") e o Funcionário do RH a muda por empregado quando for exceção. Entra pela leitura de um Cartão de ponto ou à mão, e o Funcionário do RH corrige ou preenche à mão. O Funcionário do RH marca o empregado como desligado da empresa (sai do Holerite, perde o botão do Cartão de ponto na lista e não há mais nada a editar nele; desligar grava na hora e fecha a edição) e pode readmiti-lo (também grava na hora e fecha a edição). Pode ficar "sem movimento no mês" (férias, afastamento) sem travar o Holerite. Nenhum outro dado do empregado é guardado ou exibido (é a única exceção à regra "só nome e Abono").

**Jornada**:
A carga horária do empregado por dia da semana; zero significa que não trabalha nesse dia. O Funcionário do RH não a cadastra: a Totalização deve deduzi-la da Convenção coletiva e da legislação (enquanto isso, o sistema grava o padrão do comércio, 8h45 de segunda a sexta e 4h no sábado). Dia com carga e sem batida é falta, salvo Abono ou feriado; dia sem carga (domingo) é ignorado, salvo batida na coluna Extra, que vira hora extra.

**Cartão iniciado**:
O Cartão de ponto de um empregado num mês depois de salvo ao menos uma vez pelo Funcionário do RH, com ou sem horário digitado (fica marcado, e a marca não se desfaz). Antes disso o cartão é novo: os dias úteis vazios ainda não são falta e as linhas abrem para digitar. Depois de iniciado, o dia útil sem batida e sem Abono é falta.

**Cartão de ponto**:
O registro das batidas de um empregado no mês de trabalho inteiro (28 a 31 dias), lido de uma foto ou digitado, que alimenta a planilha dele e a Totalização. É entregue em PDF individual, com as Totalizações em destaque e linhas de assinatura física do responsável e do empregado do Cliente.

**Leitura da foto do cartão**:
O Responsável do RH sobe a foto do Cartão de ponto de uma **quinzena** (1ª: dias 1 a 15; 2ª: dia 16 ao fim do mês) e o sistema preenche o cartão sem tela de confirmação (o Funcionário corrige à mão). A leitura é feita por um modelo de visão (API) atrás de uma porta neutra, e o domínio valida o resultado (nome legível, dias da quinzena sem repetição, horários válidos e em ordem); leitura que falha ou reprova = digitação manual, sem bloquear. O empregado é achado pelo nome (o primeiro nome do cartão casa com o nome inteiro do Quadro; mais de um = digitar à mão) ou cadastrado, com a Jornada deduzida do padrão das batidas. Dia útil vazio vira falta, fim de semana vazio é ignorado salvo Extra, a anotação "atestado" vira Abono (só em dia de trabalho: num domingo ou folga é ignorada) e a "faltou" é só sinalizada. A foto nunca é guardada e vai a um serviço externo sem retenção (ADR 0011).

**Abono**:
Marca de que um dia (ou o horário) não conta como falta: por anotação "atestado" no cartão ou por atestado anexado cobrindo a data. Só a sinalização é guardada, nunca o motivo médico, o CID nem o documento. Declaração de comparecimento abona só o horário.

O RH sobe a foto do atestado ou da declaração pelo botão "Ler atestado" do cartão do empregado (abre uma modal; sucesso atualiza a planilha, erro mostra o motivo e não muda nada); o leitor devolve só o nome, o tipo e as datas, nunca CID, documento ou imagem, e o domínio valida. O empregado é o do cartão aberto: o nome no documento precisa casar com o dele (o primeiro nome basta; senão o RH abona à mão), e nada abonado também é erro com o motivo. **Atestado**: abona os dias de trabalho (com carga na Jornada) do período que ainda não têm batida; fim de semana sem carga fica de fora; período acima de 31 dias o RH lança à mão. **Declaração**: vale numa data e abona só o horário, então só o dia que já tem batida (o Abono cobre a diferença da carga); em dia sem batida nada é abonado. O RH muda qualquer Abono à mão. O sistema não valida registro profissional nem rasura: o RH confere a foto antes de abonar.

**Convenção coletiva**:
O PDF da convenção do sindicato do Cliente, com vigência de um ano, que o Líder do RH ou o Admin envia e renova; as anteriores ficam no histórico. Suas cláusulas viram regras de cálculo (jornada, hora extra, adicional noturno, abonos, sábado, domingo, feriado, banco de horas) aplicadas sem aprovação, exibidas em leitura com a cláusula de origem. Cada Cliente tem uma convenção por padrão e pode ter mais de uma; havendo mais de uma, cada empregado do Quadro aponta a sua. O **sindicato** identifica a convenção: renovar é enviar outra do mesmo sindicato com vigência nova, e a anterior continua valendo para os períodos da época. A convenção nunca é editada nem apagada.

**Regras aplicadas**:
O conjunto de parâmetros que o sistema extraiu da Convenção coletiva, uma só vez, no envio do PDF: jornada semanal e diária, limite de horas extras por dia, intervalo mínimo e máximo, hora extra de sábado, datas especiais com seus percentuais e exceções de feriado. Cada parâmetro cita a cláusula e o trecho de origem; é descartado se o número não aparece no trecho, e o percentual abaixo do piso da legislação é rejeitado. O que não virou parâmetro fica **não aplicada** (vale a legislação). Valem sem aprovação manual e aparecem em leitura, com a diferença para a legislação.

**Interruptores do Cliente**:
O que a convenção não decide e o Responsável do RH liga por Cliente: banco de horas (desligado por padrão) e trabalho aos domingos.

**Totalização**:
O resultado legal das horas de um empregado no período (normais, extras por faixa, adicional noturno, atrasos, faltas, abonos), calculado das batidas pela Convenção coletiva vigente na data de cada dia (a de vigência que cobre o dia e, havendo mais de uma, a do sindicato que o empregado aponta), com a legislação onde a convenção não decide; sem convenção vigente a legislação vale e a tela avisa. Entrega minutos por faixa de percentual (sábado, datas especiais e o percentual do comissionado vêm da convenção), o que foi para o **banco de horas** (quando ligado, só dia útil e sábado) e contagens para o Holerite aplicar os valores em dinheiro: feriados trabalhados, sábados trabalhados e dias com hora extra (direito a lanche). Hora extra acima do limite diário continua paga e só aparece como alerta.

### Auditoria

**Registro de auditoria**:
Evento imutável gravado quando uma ação muda estado no sistema — grava Ator, Setor, ação, alvo e resultado. Nunca registra leituras.
_Avoid_: Log de auditoria, histórico.

**Período**:
Um intervalo de datas sempre com início e fim definidos juntos; não existe Período com só uma ponta preenchida — isso é rejeitado, não interpretado como "a partir de" ou "até". Vale em qualquer filtro por data do sistema, não só no de auditoria.
_Avoid_: Intervalo aberto (não existe nesse domínio).
