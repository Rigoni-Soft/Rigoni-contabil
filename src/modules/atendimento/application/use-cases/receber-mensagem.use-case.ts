import type {
  MensagemRecebida,
  ReceberMensagemPort,
} from "@/modules/atendimento/application/ports/in/receber-mensagem.provider";
import type { CadastroContatoPort } from "@/modules/atendimento/application/ports/out/cadastro-contato.provider";
import type {
  DocumentoContratual,
  DocumentosContratuaisPort,
} from "@/modules/atendimento/application/ports/out/documentos-contratuais.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type {
  ContatoIdentificado,
  IdentificacaoContatoPort,
} from "@/modules/atendimento/application/ports/out/identificacao-contato.provider";
import type {
  SessaoAtendimento,
  SessaoAtendimentoPort,
} from "@/modules/atendimento/application/ports/out/sessao-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { cnpjValido, normalizarCnpj } from "@/shared/kernel/cnpj";
import { err, ok, type Result } from "@/shared/kernel/result";

const OPCOES_MENU = [
  "Contrato social e alterações",
  "Guia de imposto",
  "Guia de parcelamento",
  "CND",
  "Falar com atendente",
];

const PERGUNTA_CLIENTE =
  "Olá! Não identificamos este número entre os contatos dos nossos clientes. Você já é cliente da Rigoni Contábil? Responda *sim* ou *não*.";
const PEDIR_CNPJ = "Ótimo! Informe o CNPJ da sua empresa.";
const CNPJ_INVALIDO = "Esse CNPJ não parece válido. Confira e envie novamente (ou digite *menu*).";
const SIM_OU_NAO = "Responda *sim* ou *não*.";
const PEDIR_NOME = "Para finalizar, qual é o seu nome?";
const NOME_INVALIDO = "Envie seu nome (até 80 caracteres).";
// ponytail: só avisa; a Transferência real para a recepção entra com o #44/#45 (Fila).
const PARA_RECEPCAO =
  "Sem problemas! Vamos te encaminhar para a nossa recepção, que já vai te atender. Aguarde um instante, por favor.";
const CNPJ_NAO_ENCONTRADO =
  "Não encontramos esse CNPJ em nosso cadastro. Vamos te encaminhar para a nossa recepção, que já vai te atender.";
const TAMANHO_MAX_NOME = 80;

const PERGUNTA_TIPO =
  "O que você deseja receber?\n1 - Contrato social\n2 - Alterações\n3 - Ambos (contrato social e uma alteração)\nDigite *menu* para voltar.";

const SEM_CONTRATO = "Não encontramos o contrato social cadastrado. Fale com o escritório.";
const SEM_ALTERACOES = "Não encontramos alterações contratuais cadastradas. Fale com o escritório.";

const ALTERACOES_POR_PAGINA = 10;

type Modo = "contrato" | "alteracoes" | "ambos";
const MODOS: Record<string, Modo> = { "1": "contrato", "2": "alteracoes", "3": "ambos" };

// `telefone` com DDI, como a mensagem chegou (resposta); `chave` só dígitos nacionais (sessão).
type Conversa = { contato: ContatoIdentificado; telefone: string; chave: string };
type Documentos = { contrato: DocumentoContratual | null; alteracoes: DocumentoContratual[] };

// DDI 55 é descartado: o telefone do Contato é cadastrado só com DDD + número.
function soDigitosNacionais(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
}

function respostaSimNao(texto: string): boolean | null {
  const t = texto.normalize("NFD").replace(/\p{M}/gu, "");
  if (["sim", "s"].includes(t)) return true;
  if (["nao", "n"].includes(t)) return false;
  return null;
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function descrever(documento: DocumentoContratual): string {
  return documento.data ? `Alteração de ${formatarData(documento.data)}` : "Contrato social";
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
// ponytail: se uma alteração entrar/sair com a sessão aberta, o número escolhido pode apontar
// para outra (janela de minutos); guardar os ids da lista na sessão se isso virar problema.
export class ReceberMensagem implements ReceberMensagemPort {
  constructor(
    private readonly contatos: IdentificacaoContatoPort,
    private readonly envio: EnvioMensagemPort,
    private readonly documentos: DocumentosContratuaisPort,
    private readonly sessoes: SessaoAtendimentoPort,
    private readonly cadastro: CadastroContatoPort,
  ) {}

  async execute(mensagem: MensagemRecebida): Promise<Result<void, AppError>> {
    const chave = soDigitosNacionais(mensagem.telefone);
    if (!chave) return err(new ValidationError("Telefone da mensagem é obrigatório"));

    const contato = await this.contatos.identificar(chave);
    if (!contato.ok) return contato;
    const texto = mensagem.texto.trim().toLowerCase();

    const sessao = await this.sessoes.obter(chave);
    if (!sessao.ok) return sessao;
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

  // Número que não é Contato de ninguém: "já é cliente?" → CNPJ → oferta de cadastro → nome.
  // Qualquer desvio (sessão ausente/expirada/de outro fluxo, ou "menu") recomeça pela pergunta.
  private async identificarNovo(
    { telefone, texto: original }: MensagemRecebida,
    chave: string,
    texto: string,
    sessao: SessaoAtendimento | null,
  ): Promise<Result<void, AppError>> {
    const passo = texto === "menu" ? null : sessao;
    const sim = respostaSimNao(texto);

    if (passo?.etapa === "ja_cliente" && sim !== null) {
      if (!sim) return this.encaminharRecepcao(telefone, chave, PARA_RECEPCAO);
      return this.avancar(telefone, chave, { etapa: "cnpj" }, PEDIR_CNPJ);
    }
    if (passo?.etapa === "ja_cliente") return this.enviar(telefone, SIM_OU_NAO);

    if (passo?.etapa === "cnpj") {
      if (!cnpjValido(texto)) return this.enviar(telefone, CNPJ_INVALIDO);
      const cliente = await this.cadastro.buscarCliente(normalizarCnpj(texto));
      if (!cliente.ok) return cliente;
      if (!cliente.value) return this.encaminharRecepcao(telefone, chave, CNPJ_NAO_ENCONTRADO);
      const { clienteId, empresa, temPadrao } = cliente.value;
      const como = temPadrao ? "outro contato" : "contato padrão";
      return this.avancar(
        telefone,
        chave,
        { etapa: "aceite_cadastro", clienteId },
        `Encontramos a empresa ${empresa}. Deseja cadastrar este número como ${como} dela? Responda *sim* ou *não*.`,
      );
    }

    if (passo?.etapa === "aceite_cadastro") {
      if (sim === null) return this.enviar(telefone, SIM_OU_NAO);
      if (!sim) return this.encaminharRecepcao(telefone, chave, PARA_RECEPCAO);
      return this.avancar(
        telefone,
        chave,
        { etapa: "nome_cadastro", clienteId: passo.clienteId },
        PEDIR_NOME,
      );
    }

    if (passo?.etapa === "nome_cadastro") {
      const nome = original.trim().replace(/\s+/g, " ");
      if (!nome || nome.length > TAMANHO_MAX_NOME) return this.enviar(telefone, NOME_INVALIDO);
      const criado = await this.cadastro.cadastrar({
        clienteId: passo.clienteId,
        nome,
        telefone: chave,
      });
      if (!criado.ok) return criado;
      // Já cadastrou: falhar na limpeza faria a Meta reenviar; o número agora é reconhecido.
      await this.sessoes.limpar(chave);
      const como = criado.value.padrao ? "contato padrão" : "contato";
      return this.enviar(
        telefone,
        `Pronto, ${nome}! Este número agora é ${como} de ${criado.value.empresa}. Envie qualquer mensagem para ver o menu.`,
      );
    }

    return this.avancar(telefone, chave, { etapa: "ja_cliente" }, PERGUNTA_CLIENTE);
  }

  private async avancar(
    telefone: string,
    chave: string,
    sessao: SessaoAtendimento,
    texto: string,
  ): Promise<Result<void, AppError>> {
    const salva = await this.sessoes.salvar(chave, sessao);
    return salva.ok ? this.enviar(telefone, texto) : salva;
  }

  private async encaminharRecepcao(
    telefone: string,
    chave: string,
    texto: string,
  ): Promise<Result<void, AppError>> {
    const limpa = await this.sessoes.limpar(chave);
    return limpa.ok ? this.enviar(telefone, texto) : limpa;
  }

  private async responderMenu(
    { contato, telefone, chave }: Conversa,
    texto: string,
  ): Promise<Result<void, AppError>> {
    if (texto === "1") {
      const salva = await this.sessoes.salvar(chave, { etapa: "tipo_documento" });
      return salva.ok ? this.enviar(telefone, PERGUNTA_TIPO) : salva;
    }
    const escolha = Number(texto);
    if (Number.isInteger(escolha) && escolha >= 2 && escolha <= OPCOES_MENU.length) {
      return this.enviar(
        telefone,
        `${OPCOES_MENU[escolha - 1]}: em construção. Envie qualquer mensagem para ver o menu.`,
      );
    }
    const menu = OPCOES_MENU.map((opcao, i) => `${i + 1} - ${opcao}`).join("\n");
    return this.enviar(
      telefone,
      `Olá, ${contato.nome} (${contato.empresa})! Como podemos ajudar?\n${menu}`,
    );
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
    return this.mostrarPagina(conversa, { etapa: "alteracao", modo, pagina: 1 }, alteracoes);
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

    // Alterações podem ter sido removidas com a sessão aberta: a página nunca passa da última.
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
  ): Promise<Result<void, AppError>> {
    const salva = await this.sessoes.salvar(chave, sessao);
    return salva.ok ? this.enviar(telefone, listaDaPagina(alteracoes, sessao.pagina)) : salva;
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
    try {
      return await this.envio.enviarDocumento({
        telefone,
        url: link.value,
        nomeArquivo: `${descrever(documento)}${extensao}`,
      });
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
