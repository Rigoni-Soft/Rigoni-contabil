import {
  invalidosDe,
  type EtapaIdentificacao,
} from "@/modules/atendimento/application/dtos/sessao-identificacao.dto";
import type { AbrirAtendimentoPort } from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AnexarMensagemAtendimentoPort } from "@/modules/atendimento/application/ports/in/anexar-mensagem-atendimento.provider";
import type { EntregarNaUraPort } from "@/modules/atendimento/application/ports/in/entregar-na-ura.provider";
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
  GuiaFiscal,
  GuiasFiscaisPort,
  TipoGuia,
} from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type {
  ContatoIdentificado,
  IdentificacaoContatoPort,
} from "@/modules/atendimento/application/ports/out/identificacao-contato.provider";
import type { RegistroDeErrosPort } from "@/modules/atendimento/application/ports/out/registro-de-erros.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import type {
  SessaoAtendimento,
  SessaoAtendimentoPort,
} from "@/modules/atendimento/application/ports/out/sessao-atendimento.provider";
import { AVISO_AGUARDE } from "@/modules/atendimento/domain/services/aviso-fila.service";
import {
  descreverDocumento,
  ROTULO_GUIA,
} from "@/modules/atendimento/domain/services/documento-contratual.service";
import {
  avisoDeFechado,
  estaAbertoEm,
} from "@/modules/atendimento/domain/services/expediente.service";
import { linhasNumeradas, paginar } from "@/modules/atendimento/domain/services/paginacao.service";
import {
  listaDeSetores,
  SETORES_POR_PAGINA,
  setoresDaUra,
} from "@/modules/atendimento/domain/services/setores-da-ura.service";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { cnpjValido, normalizarCnpj } from "@/shared/kernel/cnpj";
import { err, ok, type Result } from "@/shared/kernel/result";
import { SETOR_LABEL, SETOR_RECEPCAO, type SetorSlug } from "@/shared/kernel/setores";
import { soDigitosNacionais } from "@/shared/kernel/telefone";

const OPCOES_MENU: { rotulo: string; guia?: TipoGuia }[] = [
  { rotulo: "Contrato social e alterações" },
  { rotulo: ROTULO_GUIA.das, guia: "das" },
  { rotulo: ROTULO_GUIA.parcelamento, guia: "parcelamento" },
  { rotulo: ROTULO_GUIA.cnd, guia: "cnd" },
  { rotulo: "Falar com atendente" },
];
const OPCAO_ATENDENTE = OPCOES_MENU.length;
const GUIAS_DO_MENU = new Map(
  OPCOES_MENU.flatMap(({ guia }, i) => (guia ? [[String(i + 1), guia] as const] : [])),
);
const SEM_AUTORIZACAO_FISCAL = `O escritório ainda não tem autorização para consultar esse documento da sua empresa. Digite *${OPCAO_ATENDENTE}* para falar com um atendente.`;
const GUIA_INDISPONIVEL = `Não conseguimos buscar o documento agora. Tente novamente em alguns minutos ou digite *${OPCAO_ATENDENTE}* para falar com um atendente.`;

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
const PALAVRAS_DE_PESSOA =
  "atendente|humano|recepcao|recepcionista|funcionario|(falar|conversar) com (alguem|uma pessoa|gente|o contador|a contadora)";
const PEDIDO_DE_PESSOA = new RegExp(`\\b(${PALAVRAS_DE_PESSOA})\\b`);
const PEDIDO_DE_ATENDENTE = new RegExp(`\\b(${PALAVRAS_DE_PESSOA}|suporte|ajuda|duvida)\\b`);
function tirarAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "");
}

function pedeUmaPessoa(texto: string): boolean {
  return PEDIDO_DE_PESSOA.test(tirarAcentos(texto));
}

const AVISO_RECEPCAO_SEM_CADASTRO = `Não encontramos você entre os contatos cadastrados. ${ENCAMINHANDO_PARA_RECEPCAO}`;

const RESUMO_NAO_ESCOLHEU_SETOR =
  "Cliente pediu um atendente e não escolheu um setor na lista da URA (não soube qual, não quis escolher ou pediu uma pessoa).";
const RESUMO_SETOR_INVALIDO =
  "Cliente pediu um atendente: respostas inválidas seguidas na lista de setores.";
const RESUMO_PEDIU_ATENDENTE_NO_MENU =
  "Cliente pediu um atendente por texto no menu da URA, sem escolher um setor.";
const ROTULO_NAO_SEI_O_SETOR = "Não sei o setor";
const AVISO_RECEPCAO_SEM_SETOR = `Sem problema! ${ENCAMINHANDO_PARA_RECEPCAO}`;
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

type Remetente = { telefone: string; chave: string; idExterno?: string };
type Conversa = Remetente & { contato: ContatoIdentificado; texto: string };
type Origem = Remetente & { textoDoContato: string; clienteId: string | null };
type Encaminhamento = { resumo: string; aviso?: string; cnpj?: string; setor?: SetorSlug };
type Documentos = { contrato: DocumentoContratual | null; alteracoes: DocumentoContratual[] };

function origemDe(
  { contato, telefone, chave, idExterno, texto }: Conversa,
  textoDoContato = texto,
): Origem {
  return { telefone, chave, idExterno, textoDoContato, clienteId: contato.clienteId };
}

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

function listaDaPagina(alteracoes: DocumentoContratual[], numero: number): string {
  const exibida = paginar(alteracoes, numero, ALTERACOES_POR_PAGINA);
  const linhas = linhasNumeradas(exibida, descreverDocumento);
  return `Qual alteração você deseja? (página ${exibida.pagina} de ${exibida.total})\n${linhas}\nDigite *menu* para voltar.`;
}

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
    private readonly dasNaUra: EntregarNaUraPort,
    private readonly parcelamentoNaUra: EntregarNaUraPort,
    private readonly erros: RegistroDeErrosPort,
  ) {}

  async execute(mensagem: MensagemRecebida): Promise<Result<void, AppError>> {
    const chave = soDigitosNacionais(mensagem.telefone);
    if (!chave) return err(new ValidationError("Telefone da mensagem é obrigatório"));

    const anexada = await this.mensagens.execute({
      chave,
      mensagem: { autor: "contato", texto: mensagem.texto, idExterno: mensagem.id },
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
      return this.encaminhar(
        {
          telefone: mensagem.telefone,
          chave,
          idExterno: mensagem.id,
          textoDoContato: mensagem.texto,
          clienteId: null,
        },
        { resumo: RESUMO_NUMERO_AMBIGUO, aviso: NUMERO_AMBIGUO },
      );
    }
    if (!contato.value) {
      return this.identificarNovo(mensagem, chave, texto, sessao.value);
    }
    const conversa: Conversa = {
      contato: contato.value,
      telefone: mensagem.telefone,
      chave,
      idExterno: mensagem.id,
      texto: mensagem.texto,
    };
    if (texto === "menu") {
      const limpa = await this.sessoes.limpar(chave);
      if (!limpa.ok) return limpa;
      return this.responderMenu(conversa, texto);
    }
    if (sessao.value?.etapa === "tipo_documento") return this.escolherTipo(conversa, texto);
    if (sessao.value?.etapa === "alteracao") {
      return this.escolherAlteracao(conversa, sessao.value, texto);
    }
    if (sessao.value?.etapa === "setor") return this.escolherSetor(conversa, sessao.value, texto);
    return this.responderMenu(conversa, texto);
  }

  private async avisarSeFechado(telefone: string): Promise<Result<void, AppError> | null> {
    const agora = this.relogio.agora();
    const extras = await this.feriados.listarDatas();
    if (!extras.ok) return extras;
    const feriados = new Set(extras.value);
    if (estaAbertoEm(agora, feriados)) return null;
    return this.enviar(telefone, avisoDeFechado(agora, feriados));
  }

  private async identificarNovo(
    { telefone, texto: textoDoContato, id: idExterno }: MensagemRecebida,
    chave: string,
    texto: string,
    sessao: SessaoAtendimento | null,
  ): Promise<Result<void, AppError>> {
    const origem: Origem = { telefone, chave, idExterno, textoDoContato, clienteId: null };
    const etapa = texto === "menu" ? null : sessao?.etapa;
    const semAcento = tirarAcentos(texto);

    if (texto !== "menu" && PEDIDO_DE_ATENDENTE.test(semAcento)) {
      return this.encaminhar(origem, { resumo: RESUMO_PEDIU_ATENDENTE });
    }
    if (etapa === "ja_cliente") {
      if (["sim", "s"].includes(semAcento)) return this.avancar(origem, "cnpj", PEDIR_CNPJ);
      if (["nao", "n"].includes(semAcento)) {
        return this.encaminhar(origem, { resumo: RESUMO_NAO_E_CLIENTE });
      }
      return this.tratarInvalido(origem, etapa, sessao, SIM_OU_NAO);
    }
    if (etapa === "cnpj" || etapa === "cnpj_nova_tentativa") {
      if (!cnpjValido(texto)) return this.tratarInvalido(origem, etapa, sessao, CNPJ_INVALIDO);
      const cnpj = normalizarCnpj(texto);
      const cadastrado = await this.contatos.cnpjCadastrado(cnpj);
      if (!cadastrado.ok) return cadastrado;
      if (cadastrado.value) {
        return this.encaminhar(origem, { resumo: RESUMO_CNPJ_CADASTRADO, cnpj });
      }
      const primeiraTentativa = etapa === "cnpj";
      if (primeiraTentativa)
        return this.avancar(origem, "cnpj_nova_tentativa", CNPJ_NAO_ENCONTRADO);
      return this.encaminhar(origem, {
        resumo: RESUMO_CNPJ_NOVO,
        aviso: AVISO_RECEPCAO_CNPJ_NAO_ENCONTRADO,
        cnpj,
      });
    }
    return this.avancar(origem, "ja_cliente", PERGUNTA_CLIENTE);
  }

  private async tratarInvalido(
    origem: Origem,
    etapa: EtapaIdentificacao,
    sessao: SessaoAtendimento | null,
    aviso: string,
  ): Promise<Result<void, AppError>> {
    const invalidos = invalidosDe(sessao) + 1;
    if (invalidos >= MAX_INVALIDOS) {
      return this.encaminhar(origem, { resumo: RESUMO_RESPOSTAS_INVALIDAS });
    }
    const salva = await this.sessoes.salvar(origem.chave, { etapa, invalidos });
    return salva.ok ? this.enviar(origem.telefone, aviso) : salva;
  }

  private async avancar(
    { telefone, chave }: Origem,
    etapa: EtapaIdentificacao,
    texto: string,
  ): Promise<Result<void, AppError>> {
    const salva = await this.sessoes.salvar(chave, { etapa, invalidos: 0 });
    return salva.ok ? this.enviar(telefone, texto) : salva;
  }

  private async encaminhar(
    { telefone, chave, idExterno, textoDoContato, clienteId }: Origem,
    {
      resumo,
      aviso: textoAviso = AVISO_RECEPCAO_SEM_CADASTRO,
      cnpj,
      setor = SETOR_RECEPCAO,
    }: Encaminhamento,
  ): Promise<Result<void, AppError>> {
    const aviso = await this.enviar(telefone, textoAviso);
    if (!aviso.ok) return aviso;
    const aberto = await this.atendimentos.execute({
      telefone,
      chave,
      clienteId,
      cnpjInformado: cnpj,
      resumo,
      setor,
      mensagens: [
        { autor: "contato", texto: textoDoContato, idExterno },
        { autor: "ura", texto: textoAviso },
      ],
    });
    if (!aberto.ok) return aberto;
    const limpa = await this.sessoes.limpar(chave);
    if (!limpa.ok) return limpa;
    const enviado = await this.enviar(telefone, AVISO_AGUARDE);
    if (!enviado.ok) return enviado;
    const registrada = await this.mensagens.execute({
      chave,
      mensagem: { autor: "ura", texto: AVISO_AGUARDE },
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
      const setores = await this.setoresDoContato(contato);
      if (!setores.ok) return setores;
      return this.mostrarSetores(conversa, setores.value, { pagina: 1, invalidos: 0 });
    }
    if (pedeUmaPessoa(texto))
      return this.paraRecepcaoSemSetor(conversa, RESUMO_PEDIU_ATENDENTE_NO_MENU);
    const guia = GUIAS_DO_MENU.get(texto);
    if (guia === "das") return this.entregarPelaUra(conversa, guia, this.dasNaUra);
    if (guia === "parcelamento")
      return this.entregarPelaUra(conversa, guia, this.parcelamentoNaUra);
    if (guia) return this.entregarGuia(conversa, guia);
    const menu = OPCOES_MENU.map(({ rotulo }, i) => `${i + 1} - ${rotulo}`).join("\n");
    return this.enviar(
      telefone,
      `Olá, ${contato.nome} (${contato.empresa})! Como podemos ajudar?\n${menu}`,
    );
  }

  private async setoresDoContato(
    contato: ContatoIdentificado,
  ): Promise<Result<SetorSlug[], AppError>> {
    const regime = await this.contatos.regimeDoCliente(contato.clienteId);
    return regime.ok ? ok(setoresDaUra(regime.value)) : regime;
  }

  private async mostrarSetores(
    { telefone, chave }: Conversa,
    setores: SetorSlug[],
    posicao: { pagina: number; invalidos: number },
  ): Promise<Result<void, AppError>> {
    const salva = await this.sessoes.salvar(chave, { etapa: "setor", ...posicao });
    return salva.ok ? this.enviar(telefone, listaDeSetores(setores, posicao.pagina)) : salva;
  }

  private async escolherSetor(
    conversa: Conversa,
    sessao: Extract<SessaoAtendimento, { etapa: "setor" }>,
    texto: string,
  ): Promise<Result<void, AppError>> {
    if (texto === "0" || pedeUmaPessoa(texto)) {
      return this.paraRecepcaoSemSetor(
        conversa,
        RESUMO_NAO_ESCOLHEU_SETOR,
        texto === "0" ? ROTULO_NAO_SEI_O_SETOR : undefined,
      );
    }

    const lista = await this.setoresDoContato(conversa.contato);
    if (!lista.ok) return lista;
    const setores = lista.value;
    const exibida = paginar(setores, sessao.pagina, SETORES_POR_PAGINA);
    if (texto === "mais" && exibida.temMais) {
      return this.mostrarSetores(conversa, setores, { pagina: exibida.pagina + 1, invalidos: 0 });
    }

    const escolhido = exibida.escolher(texto);
    if (escolhido) {
      const nome = SETOR_LABEL[escolhido];
      return this.encaminhar(origemDe(conversa, nome), {
        setor: escolhido,
        resumo: `Cliente pediu o setor ${nome} pelo menu da URA.`,
        aviso: `Certo! Vamos te encaminhar para o setor ${nome}, que já vai te atender. Aguarde um instante, por favor.`,
      });
    }

    const invalidos = sessao.invalidos + 1;
    if (invalidos >= MAX_INVALIDOS)
      return this.paraRecepcaoSemSetor(conversa, RESUMO_SETOR_INVALIDO);
    return this.mostrarSetores(conversa, setores, { pagina: exibida.pagina, invalidos });
  }

  private paraRecepcaoSemSetor(
    conversa: Conversa,
    resumo: string,
    rotulo?: string,
  ): Promise<Result<void, AppError>> {
    return this.encaminhar(origemDe(conversa, rotulo), { resumo, aviso: AVISO_RECEPCAO_SEM_SETOR });
  }

  private async entregarGuia(
    { telefone, contato }: Conversa,
    tipo: TipoGuia,
  ): Promise<Result<void, AppError>> {
    let guia: Result<GuiaFiscal, AppError>;
    try {
      guia = await this.guias.buscar(contato.clienteId, tipo);
    } catch (erro) {
      return this.falhaInesperadaDaGuia(telefone, tipo, erro);
    }
    if (!guia.ok) return this.falhaDaGuia(telefone, tipo, guia.error);
    return this.despacharDocumento({ telefone, ...guia.value });
  }

  private async entregarPelaUra(
    { telefone, contato }: Conversa,
    tipo: TipoGuia,
    caso: EntregarNaUraPort,
  ): Promise<Result<void, AppError>> {
    try {
      const entrega = await caso.execute({ clienteId: contato.clienteId, telefone });
      return entrega.ok ? entrega : this.falhaDaGuia(telefone, tipo, entrega.error);
    } catch (erro) {
      return this.falhaInesperadaDaGuia(telefone, tipo, erro);
    }
  }

  private falhaInesperadaDaGuia(telefone: string, tipo: TipoGuia, erro: unknown) {
    this.erros.registrar(
      `Falha inesperada ao buscar a guia ${tipo}:`,
      erro instanceof Error ? erro.message : "erro desconhecido",
    );
    return this.enviar(telefone, GUIA_INDISPONIVEL);
  }

  private falhaDaGuia(telefone: string, tipo: TipoGuia, erro: AppError) {
    if (erro instanceof ForbiddenError) return this.enviar(telefone, SEM_AUTORIZACAO_FISCAL);
    this.erros.registrar(`Falha ao buscar a guia ${tipo}:`, erro.message);
    return this.enviar(telefone, GUIA_INDISPONIVEL);
  }

  private async escolherTipo(conversa: Conversa, texto: string): Promise<Result<void, AppError>> {
    const modo = MODOS[texto];
    if (!modo) return this.enviar(conversa.telefone, PERGUNTA_TIPO);

    const existentes = await this.carregar(conversa.contato);
    if (!existentes.ok) return existentes;
    const { contrato, alteracoes } = existentes.value;

    if (modo === "contrato") {
      if (!contrato) return this.enviar(conversa.telefone, SEM_CONTRATO);
      return this.entregar(conversa, [contrato]);
    }
    if (alteracoes.length === 0) {
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
    const existentes = await this.carregar(conversa.contato);
    if (!existentes.ok) return existentes;
    const { contrato, alteracoes } = existentes.value;
    if (alteracoes.length === 0) return this.enviar(conversa.telefone, SEM_ALTERACOES);

    if (sessao.lista !== impressaoDaLista(alteracoes)) {
      return this.mostrarPagina(
        conversa,
        { ...sessao, pagina: 1, lista: impressaoDaLista(alteracoes) },
        alteracoes,
        LISTA_MUDOU,
      );
    }

    const exibida = paginar(alteracoes, sessao.pagina, ALTERACOES_POR_PAGINA);
    if (texto === "mais" && exibida.temMais) {
      return this.mostrarPagina(conversa, { ...sessao, pagina: exibida.pagina + 1 }, alteracoes);
    }

    const escolhida = exibida.escolher(texto);
    if (!escolhida) {
      return this.enviar(conversa.telefone, listaDaPagina(alteracoes, exibida.pagina));
    }
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

  private async carregar(contato: ContatoIdentificado): Promise<Result<Documentos, AppError>> {
    const lista = await this.documentos.listar(contato.clienteId);
    if (!lista.ok) return lista;
    return ok({
      contrato: lista.value.find((documento) => documento.tipo === "contrato") ?? null,
      alteracoes: lista.value.filter((documento) => documento.tipo === "alteracao"),
    });
  }

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
      nomeArquivo: `${descreverDocumento(documento)}${extensao}`,
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
