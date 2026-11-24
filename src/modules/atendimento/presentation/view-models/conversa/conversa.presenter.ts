import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import { telefoneParaExibicao } from "@/presentation/lib/telefone-mask";
import type { ResultadoCadastroContatoUra } from "@/modules/atendimento/application/ports/in/cadastrar-contato-ura.provider";
import type { DocumentoParaEnviar } from "@/modules/atendimento/application/ports/in/enviar-documento-ao-cliente.provider";
import type {
  ConversaVista,
  DocumentoOferecido,
  MensagemVista,
  UltimaTransferencia,
} from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { ANEXO_LINK_MARGEM_MS, type TipoAnexoMensagem } from "@/shared/kernel/anexo";
import { FUSO_DE_NEGOCIO } from "@/shared/kernel/mes-atual";
import { opcoesDe } from "@/shared/kernel/opcoes";
import { SETOR_LABEL } from "@/shared/kernel/setores";

type AnexoView = {
  tipo: TipoAnexoMensagem;
  nome: string;
  tamanho: string;
  url: string;
  urlVisualizacao: string;
  miniaturaUrl: string | null;
};

type MensagemView = {
  id: string;
  lado: "contato" | "ura" | "atendente";
  autor: string;
  detalhe: string | null;
  texto: string;
  hora: string;
  reacao: string | null;
  reagivel: boolean;
  aviso: string | null;
  anexo: AnexoView | null;
};

export type ConversaView = {
  titulo: string;
  subtitulo: string;
  encerrado: boolean;
  somenteLeitura: boolean;
  semCliente: boolean;
  contatoUra: { pode: boolean; telefone: string; cnpjSugerido: string };
  contexto: { origem: string; resumo: string } | null;
  mensagens: MensagemView[];
  temMaisAnteriores: boolean;
  servicos: { valor: string; rotulo: string; grupo: "contrato" | "alteracao" }[];
  setoresDestino: { valor: string; rotulo: string }[];
};

const valorDaOpcao = (d: DocumentoOferecido) =>
  d.numero === null ? d.tipo : `${d.tipo}:${d.numero}`;

export function documentoDaOpcao(valor: string): DocumentoParaEnviar {
  const [tipo, numero] = valor.split(":");
  return { tipo: tipo as DocumentoParaEnviar["tipo"], numero: numero ? Number(numero) : null };
}

const FORMATO_TAMANHO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${FORMATO_TAMANHO.format(bytes / 1024)} KB`;
  return `${FORMATO_TAMANHO.format(bytes / (1024 * 1024))} MB`;
}

export function formatarCronometro(segundos: number): string {
  const mm = String(Math.floor(segundos / 60)).padStart(2, "0");
  return `${mm}:${String(segundos % 60).padStart(2, "0")}`;
}

export function reaproveitarLinks(
  nova: ConversaVista,
  anterior: ConversaVista | undefined,
  agora: number,
  margemMs = ANEXO_LINK_MARGEM_MS,
): ConversaVista {
  if (!anterior) return nova;
  const anteriores = new Map(anterior.mensagens.map((m) => [m.id, m.anexo]));
  return {
    ...nova,
    mensagens: nova.mensagens.map((m) => {
      const antigo = anteriores.get(m.id);
      if (!m.anexo || !antigo || Date.parse(antigo.expiraEm) - agora <= margemMs) return m;
      return {
        ...m,
        anexo: {
          ...m.anexo,
          url: antigo.url,
          urlVisualizacao: antigo.urlVisualizacao,
          miniaturaUrl: antigo.miniaturaUrl,
          expiraEm: antigo.expiraEm,
        },
      };
    }),
  };
}

export function manterHistorico(nova: ConversaVista, anterior: ConversaVista | undefined) {
  const primeira = nova.mensagens[0];
  if (!anterior || !primeira) return nova;
  const antigas = anterior.mensagens.filter((m) => antesDe(m, primeira));
  if (!antigas.length) return nova;
  const ids = new Set(nova.mensagens.map((m) => m.id));
  const sobrepoe = anterior.mensagens.some((m) => ids.has(m.id));
  if (!sobrepoe && nova.temMaisAnteriores) return nova;
  return {
    ...nova,
    mensagens: [...antigas, ...nova.mensagens],
    temMaisAnteriores: anterior.temMaisAnteriores,
  };
}

export function acrescentarAnteriores(
  atual: ConversaVista,
  cursorId: string,
  pagina: { mensagens: MensagemVista[]; temMaisAnteriores: boolean },
): ConversaVista {
  if (atual.mensagens[0]?.id !== cursorId) return atual;
  const ja = new Set(atual.mensagens.map((m) => m.id));
  return {
    ...atual,
    mensagens: [...pagina.mensagens.filter((m) => !ja.has(m.id)), ...atual.mensagens],
    temMaisAnteriores: pagina.temMaisAnteriores,
  };
}

export function idsComLinkVencendo(
  conversa: ConversaVista,
  agora: number,
  limite: number,
  margemMs = ANEXO_LINK_MARGEM_MS,
  elegivel: (id: string) => boolean = () => true,
): string[] {
  return conversa.mensagens
    .filter((m) => m.anexo && Date.parse(m.anexo.expiraEm) - agora <= margemMs && elegivel(m.id))
    .slice(0, limite)
    .map((m) => m.id);
}

export function aplicarLinksRenovados(
  conversa: ConversaVista,
  renovadas: MensagemVista[],
): ConversaVista {
  const novos = new Map(renovadas.map((m) => [m.id, m.anexo]));
  return {
    ...conversa,
    mensagens: conversa.mensagens.map((m) => {
      const renovado = novos.get(m.id);
      return m.anexo && renovado ? { ...m, anexo: { ...m.anexo, ...renovado } } : m;
    }),
  };
}

function antesDe(
  a: { criadoEm: string; id: string },
  b: { criadoEm: string; id: string },
): boolean {
  return a.criadoEm < b.criadoEm || (a.criadoEm === b.criadoEm && a.id < b.id);
}

const FORMATO_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_DE_NEGOCIO,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatarHora(iso: string): string {
  const partes = FORMATO_HORA.formatToParts(new Date(iso));
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? "";
  return `${p("day")}/${p("month")} ${p("hour")}:${p("minute")}`;
}

function origemDaTransferencia({ setorOrigem, origemNome }: UltimaTransferencia): string {
  const setor = SETOR_LABEL[setorOrigem];
  return origemNome ? `Transferido por ${origemNome} · ${setor}` : `Transferido do setor ${setor}`;
}

function contextoDaConversa({ ultimaTransferencia, ura }: ConversaVista): ConversaView["contexto"] {
  if (ultimaTransferencia) {
    return {
      origem: origemDaTransferencia(ultimaTransferencia),
      resumo: ultimaTransferencia.resumo,
    };
  }
  return ura?.resumo ? { origem: "Aberto pela URA", resumo: ura.resumo } : null;
}

export function conversaParaView(conversa: ConversaVista): ConversaView {
  const telefone = telefoneParaExibicao(conversa.telefone);
  const { contatoNome, empresa, cnpj } = conversa.contato;
  const nomeDoContato = contatoNome ?? telefone;
  const cnpjDoContato = cnpj ? `CNPJ ${formatarCnpj(cnpj)}` : "CNPJ não definido";

  return {
    titulo: nomeDoContato,
    subtitulo:
      empresa && cnpj
        ? `${empresa} · ${formatarCnpj(cnpj)} · ${telefone}`
        : conversa.ura?.cnpjInformado
          ? `Provável cliente novo · CNPJ informado ${formatarCnpj(conversa.ura.cnpjInformado)} · ${telefone}`
          : "Cliente não identificado",
    encerrado: conversa.encerrado,
    somenteLeitura: !conversa.encerrado && !conversa.podeAtender,
    semCliente: !conversa.clienteVinculado,
    contatoUra: {
      pode: conversa.podeCadastrarContato,
      telefone,
      cnpjSugerido: formatarCnpj(cnpj ?? conversa.ura?.cnpjInformado ?? ""),
    },
    contexto: contextoDaConversa(conversa),
    temMaisAnteriores: conversa.temMaisAnteriores,
    mensagens: conversa.mensagens.map((m) => ({
      id: m.id,
      lado: m.autor === "funcionario" ? "atendente" : m.autor,
      autor:
        m.autor === "contato"
          ? nomeDoContato
          : m.autor === "ura"
            ? "URA"
            : m.atendente
              ? `${m.atendente.nome} · ${SETOR_LABEL[m.atendente.setor]}`
              : "Atendente",
      detalhe: m.autor === "contato" ? cnpjDoContato : null,
      texto: m.texto,
      hora: formatarHora(m.criadoEm),
      reacao: m.reacao,
      reagivel: m.reagivel,
      aviso: m.entrega === "entregue" ? null : "Envio não confirmado",
      anexo: m.anexo
        ? {
            tipo: m.anexo.tipo,
            nome: m.anexo.nome,
            tamanho: formatarTamanho(m.anexo.tamanho),
            url: m.anexo.url,
            urlVisualizacao: m.anexo.urlVisualizacao,
            miniaturaUrl: m.anexo.miniaturaUrl,
          }
        : null,
    })),
    setoresDestino: opcoesDe(conversa.setoresDestino, SETOR_LABEL),
    servicos: conversa.documentos.map((doc) => ({
      valor: valorDaOpcao(doc),
      rotulo: doc.descricao,
      grupo: doc.tipo,
    })),
  };
}

export const POLLING_RAPIDO_MS = 5_000;
export const POLLING_LENTO_MS = 15_000;
const JANELA_ATIVA_MS = 120_000;

export function intervaloDaConversa(conversa: ConversaVista | undefined, agora: number): number {
  const ultima = conversa?.mensagens.at(-1);
  if (!ultima) return POLLING_RAPIDO_MS;
  return agora - new Date(ultima.criadoEm).getTime() < JANELA_ATIVA_MS
    ? POLLING_RAPIDO_MS
    : POLLING_LENTO_MS;
}

export type AvisoDoContatoUra = { tipo: "erro" | "sucesso"; texto: string; campo?: "email" };

export function avisoDoPainelDeContatoUra(
  erros: { busca?: string; cadastro?: string },
  resultado: ResultadoCadastroContatoUra | undefined,
  empresa: string | undefined,
): AvisoDoContatoUra | undefined {
  const erro = erros.busca ?? erros.cadastro;
  if (erro) return { tipo: "erro", texto: erro };
  if (resultado && empresa) return avisoDoResultadoDoContatoUra(resultado, empresa);
  return undefined;
}

function avisoDoResultadoDoContatoUra(
  resultado: ResultadoCadastroContatoUra,
  empresa: string,
): AvisoDoContatoUra {
  switch (resultado.status) {
    case "criado":
      return { tipo: "sucesso", texto: `${resultado.nome} cadastrado como contato de ${empresa}.` };
    case "existente":
      return {
        tipo: "sucesso",
        texto: `Este número já é o contato ${resultado.nome} de ${empresa}. Nada foi alterado.`,
      };
    case "email_em_uso":
      return {
        tipo: "erro",
        texto: `Este e-mail já é do contato ${resultado.nome} de ${empresa}. Nada foi cadastrado.`,
        campo: "email",
      };
    case "em_outro_cliente":
      return {
        tipo: "erro",
        texto:
          "Este número já é contato de outro Cliente. Nada foi cadastrado; confirme o Cliente.",
      };
  }
}
