# Clientes: infra e view-models (regras antes guardadas em comentário)

## Repositório de Responsável e de tipos de envio do contato
O banco (gatilho + RLS) é a última barreira: o gatilho recusa quem não é Funcionário ativo do Setor, e o Setor e a permissão de `definir_tipos_de_envio_do_contato` vêm do banco, nunca do chamador; o canal sai do próprio Contato. Todo Setor guarda o Responsável em `cliente_responsaveis` (um por Cliente e Setor). Contato com os dois canais sem canal escolhido e Contato de outro Cliente ou tipo fora do catálogo do Setor (chave estrangeira) são recusados.
Onde vive: src/modules/clientes/infra/repositories/responsavel-cliente.repository.ts, tipos-de-envio-do-contato.repository.ts (e os .test.ts ao lado).

## Teto de upload na Server Action
O corpo de uma Server Action na Vercel tem teto de 4,5 MB (ADR 0007): 4 MB deixa folga. No cadastro de Cliente os arquivos vão todos em uma Server Action cortada em 11 MB (next.config.ts); acima disso a requisição falha antes do caso de uso.
Onde vive: anexar-alteracao-contratual.schema.ts:LIMITE_DO_ARQUIVO_DA_ALTERACAO_EM_BYTES, anexar-guia-parcela-pgfn.schema.ts:LIMITE_DO_ARQUIVO_DA_GUIA_EM_BYTES, criar-cliente.schema.ts:LIMITE_DOS_ARQUIVOS_DO_CADASTRO_EM_BYTES (em src/modules/clientes/presentation/view-models/).

## Alteração contratual: nº repetido e data
O schema não conhece as alterações do Cliente: nº repetido é checado pela lista carregada na tela e, no fim, pelo banco (23505). Divergência entre nº e data só avisa (data anterior à da alteração de nº menor), não bloqueia. Só o Admin recebe o container. A sugestão do nº só ocorre com o campo vazio.
Onde vive: src/modules/clientes/presentation/view-models/anexar-alteracao-contratual/anexar-alteracao-contratual.presenter.ts e .schema.ts.

## Guia de parcela PGFN: conferência antes de liberar
Liberar ao envio e remover não se desfazem: pedem confirmação na linha. Confirmar vale para a versão do PDF que a tela mostrava; se outro entrou depois, o servidor recusa e a tela relê. Guia anexada e gravada mas não liberada é aviso de atenção (nem sucesso nem erro). Competência e conta só se digitam quando o PDF não pôde ser lido; segundo anexo na competência e competência já enviada são recusados pelo banco. Botões ocupados ficam aria-disabled e o clique avisa que há ação em curso. O foco volta ao item/botão de origem quando um botão some.
Onde vive: src/modules/clientes/presentation/view-models/anexar-guia-parcela-pgfn/use-guias-da-parcela.hook.ts, anexar-guia-parcela-pgfn.schema.ts, .presenter.ts (ids de foco), container.spec.tsx.

## Avisos de Cadastro: sino
Server Action é endpoint público (arquitetura.md §3.13): o cursor e o clienteId são validados mesmo vindos da UI. Ids do seed não são UUID v4, por isso z.guid() e não z.uuid(). A chave de query leva o id do usuário: o QueryClient sobrevive ao logout/login e sem o id o usuário B veria dados do A. Atualização por polling a cada 30 s e a cada navegação (Realtime, arquitetura.md 4.2, quando o atraso incomodar). A lista só é lida com o modal aberto. Leitor de tela só é avisado quando o contador sobe depois da primeira leitura. Falha de leitura mantém o último contador; falha de marcação navega mesmo assim e relê o estado real. O cabeçalho mora no módulo clientes porque a presentation global não importa módulos.
Onde vive: src/modules/clientes/presentation/view-models/avisos-cadastro/ (actions, queries, hook, presenter, cabecalho-do-shell.container.tsx).

## Busca de Cliente
Admin e RH vão à tela própria /clientes/[id]; os demais papéis editam no painel embutido. A busca embutida no dashboard do Simples Nacional restringe a Regime simples_nacional/mei. Ao salvar no painel embutido, ele fecha e a página atualiza para os cards refletirem. Destaque de teclado é estado visual efêmero e fica no Container (arquitetura.md §4.7); o foco vai ao título do painel ao selecionar. Debounce simples; cache e estado ficam no React Query.
Onde vive: src/modules/clientes/presentation/view-models/buscar-cliente/.

## Criar Cliente e consulta de CNPJ
A consulta usa a BrasilAPI (pública, sem chave) com timeout curto e AbortController; preenche Empresa e, quando certo (Simples Nacional ou MEI), Regime; Lucro Presumido e Real não são distinguíveis, então o Regime fica em branco. Falha ou não encontrado devolve null e não trava o cadastro manual. Não há estado "pendente" de propósito: re-renderizaria o formulário em corrida com useFieldArray.append() (reproduzida em E2E); o setState da resposta vai em setTimeout pela mesma causa. Resposta obsoleta (CNPJ trocado ou reset) é descartada. CNPJ com dígito verificador inválido não é consultado. Limpar pede confirmação quando há algo preenchido, pois descarta arquivos. PDF ou DOCX são validados no accept e no schema.
Onde vive: src/modules/clientes/presentation/view-models/criar-cliente/use-consultar-cnpj.hook.ts (SEM_DADOS_PUBLICOS, regimeConfirmadoPelaApi), criar-cliente.container.tsx (emOutroCicloDeRender), criar-cliente.schema.ts.

## Cadastro operacional: contatos e Responsável
Admin só cadastra contatos (sem Setor, não define destinos); o Setor SN define os destinos e edita só os contatos que cadastrou; só o Líder do SN troca o Responsável. O contato é do Setor quando ele o cadastrou ou o escolheu (tem Destino dele). Nome, WhatsApp e e-mail são editados pelo Setor dono e pelo Admin; os outros Setores só marcam o que recebem. Número repetido (mesma chave do banco: dígitos sem o DDI 55) avisa e oferece usar o contato existente. Contatos e Parcelamentos sem registros abrem com uma linha em branco que sai antes da validação e do envio, com o índice original para devolver o erro à linha certa. "Enviado" só o sistema grava. Depois de salvar, painel embutido fecha e tela própria navega (união discriminada por tipo). O Documento jurídico não depende do cadastro SN. Limpar reverte ao que veio do servidor.
Onde vive: src/modules/clientes/presentation/view-models/editar-cadastro-operacional/ (container, presenter, contato-da-linha.presenter.ts, atribuir-responsavel.actions.ts).
