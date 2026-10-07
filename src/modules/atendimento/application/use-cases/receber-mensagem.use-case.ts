import {
  invalidosDe,
  type EtapaIdentificacao,
} from "@/modules/atendimento/application/dtos/sessao-identificacao.dto";
import type { AbrirAtendimentoPort } from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AnexarMensagemAtendimentoPort } from "@/modules/atendimento/application/ports/in/anexar-mensagem-atendimento.provider";
import type {
  MensagemRecebida,
  ReceberMensagemPort,
} from "@/modules/atendimento/application/ports/in/receber-mensagem.provider";
import type {
  DocumentoContratual,
  DocumentosContratuaisPort,
} from "@/modules/atendimento/application/ports/out/documentos-contratuais.provider";
import type {
  DocumentoEnviado,
  EnvioMensagemPort,
} from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { FeriadosPort } from "@/modules/atendimento/application/ports/out/feriados.provider";
import type {
  GuiasFiscaisPort,
  TipoGuia,
} from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type {
  ContatoIdentificado,
  IdentificacaoContatoPort,
} from "@/modules/atendimento/application/ports/out/identificacao-contato.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import type {
  SessaoAtendimento,
  SessaoAtendimentoPort,
} from "@/modules/atendimento/application/ports/out/sessao-atendimento.provider";
import {
  avisoDeFechado,
  estaAbertoEm,
} from "@/modules/atendimento/domain/services/expediente.service";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { cnpjValido, normalizarCnpj } from "@/shared/kernel/cnpj";
import { formatarDataIso } from "@/shared/kernel/data-iso";
import { err, ok, type Result } from "@/shared/kernel/result";

const OPCOES_MENU = [
  "Contrato social e alterações",
  "Guia de imposto",
  "Guia de parcelamento",
  "CND",
  "Falar com atendente",
];
// "Falar com atendente" é sempre a última opção do menu; a constante acompanha o array.
const OPCAO_ATENDENTE = OPCOES_MENU.length;
// Opções 2 a 4 do menu: o PDF vem do provedor fiscal.
const GUIAS_DO_MENU: Record<string, TipoGuia> = { "2": "das", "3": "parcelamento", "4": "cnd" };
const SEM_AUTORIZACAO_FISCAL =
  "O escritório ainda não tem autorização para consultar esse documento da sua empresa. Digite *5* para falar com um atendente.";
const GUIA_INDISPONIVEL =
  "Não conseguimos buscar o documento agora. Tente novamente em alguns minutos ou digite *5* para falar com um atendente.";

const PERGUNTA_CLIENTE =
  "Olá! Não identificamos este número entre os contatos dos nossos clientes. Você já é cliente da Rigoni Contábil? Responda *sim* ou *não*.";
const SIM_OU_NAO = "Responda *sim* ou *não*.";
const PEDIR_CNPJ = "Ótimo! Informe o CNPJ da sua empresa.";
const MAX_INVALIDOS = 3;
const CNPJ_INVALIDO = "Esse CNPJ não parece válido. Confira e envie novamente (ou digite *menu*).";
const NUMERO_AMBIGUO =
  "Seu número está cadastrado em mais de uma empresa e não conseguimos confirmar qual delas você quer consultar. Vamos te encaminhar para a nossa recepção, que já vai te atender. Aguarde um instante, por favor.";

const SEM_CNPJ = "Não encontramos esse CNPJ entre os nossos clientes.";
const CNPJ_NAO_ENCONTRADO = `${SEM_CNPJ} Confira e envie novamente (ou digite *menu*).`;
const ENCAMINHANDO_PARA_RECEPCAO =
  "Vamos te encaminhar para a nossa recepção, que já vai te atender. Aguarde um instante, por favor.";
const AVISO_RECEPCAO_CNPJ_NAO_ENCONTRADO = `${SEM_CNPJ} ${ENCAMINHANDO_PARA_RECEPCAO}`;
// Palavras que, num número não reconhecido, pedem uma pessoa em vez de seguir o fluxo.
const PEDIDO_DE_ATENDENTE =
  /\b(atendente|humano|recepcao|recepcionista|suporte|ajuda|funcionario|duvida|(falar|conversar) com (alguem|uma pessoa|gente|o contador|a contadora))\b/;
const AVISO_RECEPCAO_SEM_CADASTRO = `Não encontramos você entre os contatos cadastrados. ${ENCAMINHANDO_PARA_RECEPCAO}`;
const AVISO_RECEPCAO_PEDIDO_NO_MENU = `Certo! ${ENCAMINHANDO_PARA_RECEPCAO}`;

// O que a recepção lê ao assumir (`atendimentos.resumo_ura`): a origem é sempre a URA.
const RESUMO_PEDIDO_NO_MENU = "Cliente pediu a recepção pelo menu da URA.";
const RESUMO_NUMERO_AMBIGUO =
  "Número cadastrado como Contato de mais de uma empresa: confirmar com o contato qual deseja.";
const RESUMO_PEDIU_ATENDENTE = "Contato não encontrado: o número pediu um atendente.";
const RESUMO_NAO_E_CLIENTE = "Contato não encontrado: o número disse não ser cliente.";
const RESUMO_RESPOSTAS_INVALIDAS = "Contato não encontrado: respostas inválidas seguidas.";
const RESUMO_CNPJ_CADASTRADO =
  "Contato não encontrado: o número não consta nos contatos do Cliente do CNPJ informado.";
const RESUMO_CNPJ_NOVO =
  "Contato não encontrado: o CNPJ informado não existe no sistema (provável cliente novo).";

const PERGUNTA_TIPO =
  "O que você deseja receber?\n1 - Contrato social\n2 - Alterações\n3 - Ambos (contrato social e uma alteração)\nDigite *menu* para voltar.";

const SEM_CONTRATO = "Não encontramos o contrato social cadastrado. Fale com o escritório.";
const SEM_ALTERACOES = "Não encontramos alterações contratuais cadastradas. Fale com o escritório.";

const LISTA_MUDOU =
  "A lista de alterações foi atualizada e a sua escolha não foi considerada. Escolha novamente:\n";

const ALTERACOES_POR_PAGINA = 10;

type Modo = "contrato" | "alteracoes" | "ambos";
const MODOS: Record<string, Modo> = { "1": "contrato", "2": "alteracoes", "3": "ambos" };

// `telefone` com DDI, como a mensagem chegou (resposta); `chave` só dígitos nacionais (sessão).
type Remetente = { telefone: string; chave: string };
type Conversa = Remetente & { contato: ContatoIdentificado };
// O que o remetente disse, para abrir o Atendimento na recepção; `clienteId` null = número sem Contato.
type Origem = Remetente & { textoDoContato: string; clienteId: string | null };
// Por que vai à recepção: `cnpj` é o CNPJ (normalizado) que o número informou, quando informou; o
// banco o liga ao Cliente se existir, e sem Cliente a recepção vê um provável cliente novo.
type Encaminhamento = { resumo: string; aviso?: string; cnpj?: string };
type Documentos = { contrato: DocumentoContratual | null; alteracoes: DocumentoContratual[] };

function origemDe({ contato, telefone, chave }: Conversa, textoDoContato: string): Origem {
  return { telefone, chave, textoDoContato, clienteId: contato.clienteId };
}

// DDI 55 é descartado: o telefone do Contato é cadastrado só com DDD + número.
function soDigitosNacionais(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
}

function descrever(documento: DocumentoContratual): string {
  return documento.data ? `Alteração de ${formatarDataIso(documento.data)}` : "Contrato social";
}

// Impressão digital da lista inteira (a numeração das páginas depende de todos os itens). Hash
// não criptográfico (cyrb53, 53 bits): só detecta mudança, não protege nada, e a camada de
// aplicação não importa `crypto` (infra). Colisão exigiria uma lista diferente com o mesmo hash.
function impressaoDaLista(alteracoes: DocumentoContratual[]): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (const ch of alteracoes.map((a) => a.caminho).join("\n")) {
    const codigo = ch.codePointAt(0) as number;
    h1 = Math.imul(h1 ^ codigo, 2654435761);
    h2 = Math.imul(h2 ^ codigo, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function paginaDe(alteracoes: DocumentoContratual[], pagina: number): DocumentoContratual[] {
  return alteracoes.slice((pagina - 1) * ALTERACOES_POR_PAGINA, pagina * ALTERACOES_POR_PAGINA);
}

function listaDaPagina(alteracoes: DocumentoContratual[], pagina: number): string {
  const total = Math.ceil(alteracoes.length / ALTERACOES_POR_PAGINA);
  const itens = paginaDe(alteracoes, pagina)
    .map((a, i) => `${i + 1} - ${descrever(a)}`)
    .join("\n");
  const mais = pagina < total ? "\nDigite *mais* para ver as próximas." : "";
  return `Qual alteração você deseja? (página ${pagina} de ${total})\n${itens}${mais}\nDigite *menu* para voltar.`;
}

// Passos do menu de documentos ficam numa sessão que guarda só a posição (etapa/modo/página):
// nada do Cliente é persistido, os documentos são relidos a cada mensagem. "1".."5" é escolha
// de menu; qualquer outro texto reabre a saudação com o menu.
// A sessão guarda também um hash da lista de alterações exibida: se ela mudar antes da escolha,
// nada é entregue e a lista nova é mostrada.
export class ReceberMensagem implements ReceberMensagemPort {
  constructor(
    private readonly contatos: IdentificacaoContatoPort,
    private readonly envio: EnvioMensagemPort,
    private readonly documentos: DocumentosContratuaisPort,
    private readonly sessoes: SessaoAtendimentoPort,
    private readonly atendimentos: AbrirAtendimentoPort,
    private readonly mensagens: AnexarMensagemAtendimentoPort,
    private readonly relogio: RelogioPort,
    private readonly feriados: FeriadosPort,
    private readonly guias: GuiasFiscaisPort,
  ) {}

  async execute(mensagem: MensagemRecebida): Promise<Result<void, AppError>> {
    const chave = soDigitosNacionais(mensagem.telefone);
    if (!chave) return err(new ValidationError("Telefone da mensagem é obrigatório"));

    // Quem já tem Atendimento em andamento continua nele; a URA não recomeça.
    // ponytail: sem resposta automática, quem responde é o Funcionário (tela de atendimento do Funcionário ainda não existe).
    const anexada = await this.mensagens.execute({
      chave,
      mensagem: { autor: "contato", texto: mensagem.texto },
    });
    if (!anexada.ok) return anexada;
    if (anexada.value.anexada) return ok(undefined);

    const fechado = await this.avisarSeFechado(mensagem.telefone);
    if (fechado) return fechado;

    const contato = await this.contatos.identificar(chave);
    if (!contato.ok) return contato;
    const texto = mensagem.texto.trim().toLowerCase();

    const sessao = await this.sessoes.obter(chave);
    if (!sessao.ok) return sessao;
    if (contato.value === "ambiguo") {
      // Nenhum documento é oferecido: sem confirmar a empresa, a recepção decide.
      return this.encaminharRecepcao(
        { telefone: mensagem.telefone, chave, textoDoContato: mensagem.texto, clienteId: null },
        { resumo: RESUMO_NUMERO_AMBIGUO, aviso: NUMERO_AMBIGUO },
      );
    }
    if (!contato.value) {
      return this.identificarNovo(mensagem, chave, texto, sessao.value);
    }
    const conversa: Conversa = { contato: contato.value, telefone: mensagem.telefone, chave };
    if (texto === "menu") {
      const limpa = await this.sessoes.limpar(chave);
      if (!limpa.ok) return limpa;
    } else if (sessao.value?.etapa === "tipo_documento") {
      return this.escolherTipo(conversa, texto);
    } else if (sessao.value?.etapa === "alteracao") {
      return this.escolherAlteracao(conversa, sessao.value, texto);
    }
    return this.responderMenu(conversa, texto);
  }

  // Fora do expediente a URA só avisa o horário: nada de menu, documento, sessão ou Atendimento.
  // Devolve o resultado do aviso, ou `null` com o escritório aberto. Os feriados cadastrados só
  // fecham mais dias, nunca abrem: se o calendário nacional já diz "fechado", a falha ao lê-los não
  // impede o aviso (no máximo a data da volta ignora um feriado local); se diz "aberto", sem eles
  // não dá para saber, e o erro faz a Meta reenviar.
  private async avisarSeFechado(telefone: string): Promise<Result<void, AppError> | null> {
    const agora = this.relogio.agora();
    const fechadoNoCalendarioNacional = !estaAbertoEm(agora, new Set());
    const extras = await this.feriados.listarDatas();
    if (!extras.ok && !fechadoNoCalendarioNacional) return extras;
    const feriados = new Set(extras.ok ? extras.value : []);
    if (!fechadoNoCalendarioNacional && estaAbertoEm(agora, feriados)) return null;
    return this.enviar(telefone, avisoDeFechado(agora, feriados));
  }

  // Número sem Contato: "já é cliente?" → CNPJ → recepção. Mesmo com o CNPJ o número não é um
  // Contato (já foi buscado em todos os Clientes), então o fim é sempre a recepção; CNPJ que não
  // existe em nenhum cadastro tem 1 nova tentativa antes. Pedido de atendente em qualquer etapa
  // vai direto à recepção; sessão ausente/expirada/de outro fluxo ou "menu" recomeça pela pergunta.
  private async identificarNovo(
    { telefone, texto: textoDoContato }: MensagemRecebida,
    chave: string,
    texto: string,
    sessao: SessaoAtendimento | null,
  ): Promise<Result<void, AppError>> {
    const origem: Origem = { telefone, chave, textoDoContato, clienteId: null };
    const etapa = texto === "menu" ? null : sessao?.etapa;
    const semAcento = texto.normalize("NFD").replace(/\p{M}/gu, "");

    if (texto !== "menu" && PEDIDO_DE_ATENDENTE.test(semAcento)) {
      return this.encaminharRecepcao(origem, { resumo: RESUMO_PEDIU_ATENDENTE });
    }
    if (etapa === "ja_cliente") {
      if (["sim", "s"].includes(semAcento)) return this.avancar(origem, "cnpj", PEDIR_CNPJ);
      if (["nao", "n"].includes(semAcento)) {
        return this.encaminharRecepcao(origem, { resumo: RESUMO_NAO_E_CLIENTE });
      }
      return this.tratarInvalido(origem, etapa, sessao, SIM_OU_NAO);
    }
    if (etapa === "cnpj" || etapa === "cnpj_nova_tentativa") {
      if (!cnpjValido(texto)) return this.tratarInvalido(origem, etapa, sessao, CNPJ_INVALIDO);
      const cnpj = normalizarCnpj(texto);
      const cadastrado = await this.contatos.cnpjCadastrado(cnpj);
      if (!cadastrado.ok) return cadastrado;
      if (cadastrado.value) {
        return this.encaminharRecepcao(origem, { resumo: RESUMO_CNPJ_CADASTRADO, cnpj });
      }
      const primeiraTentativa = etapa === "cnpj";
      if (primeiraTentativa)
        return this.avancar(origem, "cnpj_nova_tentativa", CNPJ_NAO_ENCONTRADO);
      return this.encaminharRecepcao(origem, {
        resumo: RESUMO_CNPJ_NOVO,
        aviso: AVISO_RECEPCAO_CNPJ_NAO_ENCONTRADO,
        cnpj,
      });
    }
    return this.avancar(origem, "ja_cliente", PERGUNTA_CLIENTE);
  }

  // Sem contador o cliente ficaria preso em resposta inválida (sim/não ou CNPJ): ao passar do
  // limite vai à recepção.
  private async tratarInvalido(
    origem: Origem,
    etapa: EtapaIdentificacao,
    sessao: SessaoAtendimento | null,
    aviso: string,
  ): Promise<Result<void, AppError>> {
    const invalidos = invalidosDe(sessao) + 1;
    if (invalidos >= MAX_INVALIDOS) {
      return this.encaminharRecepcao(origem, { resumo: RESUMO_RESPOSTAS_INVALIDAS });
    }
    const salva = await this.sessoes.salvar(origem.chave, { etapa, invalidos });
    return salva.ok ? this.enviar(origem.telefone, aviso) : salva;
  }

  // Trocar de etapa zera o contador de respostas inválidas (cada etapa tem o seu).
  private async avancar(
    { telefone, chave }: Origem,
    etapa: EtapaIdentificacao,
    texto: string,
  ): Promise<Result<void, AppError>> {
    const salva = await this.sessoes.salvar(chave, { etapa, invalidos: 0 });
    return salva.ok ? this.enviar(telefone, texto) : salva;
  }

  private async encaminharRecepcao(
    { telefone, chave, textoDoContato, clienteId }: Origem,
    { resumo, aviso: textoAviso = AVISO_RECEPCAO_SEM_CADASTRO, cnpj }: Encaminhamento,
  ): Promise<Result<void, AppError>> {
    // Aviso antes de abrir: se o envio falhar e a Meta reenviar, não nasce Atendimento duplicado.
    const aviso = await this.enviar(telefone, textoAviso);
    if (!aviso.ok) return aviso;
    const aberto = await this.atendimentos.execute({
      telefone,
      chave,
      clienteId,
      cnpjInformado: cnpj,
      resumo,
      setor: "recepcao",
      mensagens: [
        { autor: "contato", texto: textoDoContato },
        { autor: "ura", texto: textoAviso },
      ],
    });
    if (!aberto.ok) return aberto;
    const limpa = await this.sessoes.limpar(chave);
    if (!limpa.ok) return limpa;
    // Sem Funcionário livre o Atendimento entrou na Fila: o cliente fica sabendo a posição. O aviso
    // vem depois de abrir porque a posição só existe com o Atendimento criado.
    if (aberto.value.posicao === undefined) return ok(undefined);
    const avisoFila = `Você está na posição ${aberto.value.posicao} da fila de atendimento. Aguarde, por favor.`;
    const enviado = await this.enviar(telefone, avisoFila);
    if (!enviado.ok) return enviado;
    const registrada = await this.mensagens.execute({
      chave,
      mensagem: { autor: "ura", texto: avisoFila },
    });
    return registrada.ok ? ok(undefined) : registrada;
  }

  private async responderMenu(conversa: Conversa, texto: string): Promise<Result<void, AppError>> {
    const { contato, telefone, chave } = conversa;
    if (texto === "1") {
      const salva = await this.sessoes.salvar(chave, { etapa: "tipo_documento" });
      return salva.ok ? this.enviar(telefone, PERGUNTA_TIPO) : salva;
    }
    if (texto === String(OPCAO_ATENDENTE)) {
      // A Mensagem registrada é o rótulo da opção, não o dígito: o Funcionário lê o pedido do
      // contato em vez de um "5" solto.
      return this.encaminharRecepcao(origemDe(conversa, OPCOES_MENU[OPCAO_ATENDENTE - 1]), {
        resumo: RESUMO_PEDIDO_NO_MENU,
        aviso: AVISO_RECEPCAO_PEDIDO_NO_MENU,
      });
    }
    if (texto in GUIAS_DO_MENU) return this.entregarGuia(conversa, GUIAS_DO_MENU[texto]);
    const menu = OPCOES_MENU.map((opcao, i) => `${i + 1} - ${opcao}`).join("\n");
    return this.enviar(
      telefone,
      `Olá, ${contato.nome} (${contato.empresa})! Como podemos ajudar?\n${menu}`,
    );
  }

  // O provedor fiscal é falha esperada por Cliente (sem autorização, fora do ar): o contato é
  // avisado e a mensagem fica resolvida, em vez de a Meta reenviar para sempre. Só falhar o envio
  // do PDF/aviso devolve erro.
  private async entregarGuia(
    { telefone, contato }: Conversa,
    tipo: TipoGuia,
  ): Promise<Result<void, AppError>> {
    let guia: Awaited<ReturnType<GuiasFiscaisPort["buscar"]>>;
    try {
      guia = await this.guias.buscar(contato.clienteId, tipo);
    } catch {
      return this.enviar(telefone, GUIA_INDISPONIVEL);
    }
    if (!guia.ok) {
      const aviso =
        guia.error instanceof ValidationError ? SEM_AUTORIZACAO_FISCAL : GUIA_INDISPONIVEL;
      return this.enviar(telefone, aviso);
    }
    return this.despacharDocumento({ telefone, ...guia.value });
  }

  private async escolherTipo(conversa: Conversa, texto: string): Promise<Result<void, AppError>> {
    const modo = MODOS[texto];
    if (!modo) return this.enviar(conversa.telefone, PERGUNTA_TIPO);

    const docs = await this.carregar(conversa.contato);
    if (!docs.ok) return docs;
    const { contrato, alteracoes } = docs.value;

    if (modo === "contrato") {
      if (!contrato) return this.enviar(conversa.telefone, SEM_CONTRATO);
      return this.entregar(conversa, [contrato]);
    }
    if (alteracoes.length === 0) {
      // "Ambos" sem alterações ainda entrega o contrato.
      if (modo === "ambos" && contrato) return this.entregar(conversa, [contrato]);
      return this.enviar(conversa.telefone, SEM_ALTERACOES);
    }
    if (alteracoes.length === 1) {
      return this.entregar(conversa, modo === "ambos" ? [contrato, alteracoes[0]] : alteracoes);
    }
    return this.mostrarPagina(
      conversa,
      { etapa: "alteracao", modo, pagina: 1, lista: impressaoDaLista(alteracoes) },
      alteracoes,
    );
  }

  private async escolherAlteracao(
    conversa: Conversa,
    sessao: Extract<SessaoAtendimento, { etapa: "alteracao" }>,
    texto: string,
  ): Promise<Result<void, AppError>> {
    const docs = await this.carregar(conversa.contato);
    if (!docs.ok) return docs;
    const { contrato, alteracoes } = docs.value;
    if (alteracoes.length === 0) return this.enviar(conversa.telefone, SEM_ALTERACOES);

    // Lista mudou desde que foi exibida: o número digitado pode apontar para outro documento
    // jurídico, então nada é entregue e a lista atualizada é mostrada de novo.
    if (sessao.lista !== impressaoDaLista(alteracoes)) {
      return this.mostrarPagina(
        conversa,
        { ...sessao, pagina: 1, lista: impressaoDaLista(alteracoes) },
        alteracoes,
        LISTA_MUDOU,
      );
    }

    const ultimaPagina = Math.ceil(alteracoes.length / ALTERACOES_POR_PAGINA);
    const pagina = Math.min(sessao.pagina, ultimaPagina);
    if (texto === "mais" && pagina < ultimaPagina) {
      return this.mostrarPagina(conversa, { ...sessao, pagina: pagina + 1 }, alteracoes);
    }

    const escolhida = /^\d+$/.test(texto)
      ? paginaDe(alteracoes, pagina)[Number(texto) - 1]
      : undefined;
    if (!escolhida) return this.enviar(conversa.telefone, listaDaPagina(alteracoes, pagina));
    return this.entregar(conversa, sessao.modo === "ambos" ? [contrato, escolhida] : [escolhida]);
  }

  private async mostrarPagina(
    { telefone, chave }: Conversa,
    sessao: SessaoAtendimento & { etapa: "alteracao" },
    alteracoes: DocumentoContratual[],
    aviso = "",
  ): Promise<Result<void, AppError>> {
    const salva = await this.sessoes.salvar(chave, sessao);
    return salva.ok
      ? this.enviar(telefone, `${aviso}${listaDaPagina(alteracoes, sessao.pagina)}`)
      : salva;
  }

  // Contrato à parte; alterações da mais recente para a mais antiga.
  private async carregar(contato: ContatoIdentificado): Promise<Result<Documentos, AppError>> {
    const lista = await this.documentos.listar(contato.clienteId);
    if (!lista.ok) return lista;
    return ok({
      contrato: lista.value.find((d) => d.tipo === "contrato") ?? null,
      alteracoes: lista.value
        .filter((d) => d.tipo === "alteracao")
        .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "")),
    });
  }

  // Encerra a sessão só depois de entregar: se o envio falhar, a Meta reenvia a mensagem e o
  // cliente continua do mesmo ponto. `null` = contrato pedido ("ambos") mas não cadastrado.
  private async entregar(
    { telefone, chave }: Conversa,
    documentos: (DocumentoContratual | null)[],
  ): Promise<Result<void, AppError>> {
    for (const documento of documentos) {
      const enviado = documento
        ? await this.enviarDocumento(telefone, documento)
        : await this.enviar(telefone, SEM_CONTRATO);
      if (!enviado.ok) return enviado;
    }
    // Já entregou: falhar aqui faria a Meta reenviar a mensagem e duplicar o documento. A
    // sessão que sobrar expira sozinha (10 min) ou some com "menu".
    await this.sessoes.limpar(chave);
    return ok(undefined);
  }

  private async enviarDocumento(
    telefone: string,
    documento: DocumentoContratual,
  ): Promise<Result<void, AppError>> {
    const link = await this.documentos.linkTemporario(documento.caminho);
    if (!link.ok) return link;
    const extensao = /\.[A-Za-z0-9]+$/.exec(documento.caminho)?.[0] ?? "";
    return this.despacharDocumento({
      telefone,
      url: link.value,
      nomeArquivo: `${descrever(documento)}${extensao}`,
    });
  }

  private async despacharDocumento(documento: DocumentoEnviado): Promise<Result<void, AppError>> {
    try {
      return await this.envio.enviarDocumento(documento);
    } catch {
      return err(new ServicoExternoError("Falha ao enviar o documento."));
    }
  }

  private async enviar(telefone: string, texto: string): Promise<Result<void, AppError>> {
    try {
      return await this.envio.enviar({ telefone, texto });
    } catch {
      return err(new ServicoExternoError("Falha ao enviar a mensagem."));
    }
  }
}
