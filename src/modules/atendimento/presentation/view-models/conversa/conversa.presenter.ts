import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import { telefoneParaExibicao } from "@/presentation/lib/telefone-mask";
import type {
  ConversaVista,
  DocumentoDisponivel,
  DocumentoOferecido,
  UltimaTransferencia,
} from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { SETOR_LABEL } from "@/shared/kernel/setores";

export type AnexoView = {
  tipo: "imagem" | "audio" | "documento";
  nome: string;
  // Já formatado ("1,2 MB").
  tamanho: string;
  url: string;
};

export type MensagemView = {
  id: string;
  lado: "contato" | "ura" | "atendente";
  autor: string;
  // Só no balão do cliente: a empresa a que o Atendimento pertence.
  detalhe: string | null;
  texto: string;
  hora: string;
  // Reação do escritório (emoji) e se ainda dá para reagir a esta Mensagem.
  reacao: string | null;
  reagivel: boolean;
  anexo: AnexoView | null;
};

export type ConversaView = {
  titulo: string;
  subtitulo: string;
  encerrado: boolean;
  semCliente: boolean;
  avisoInatividade: boolean;
  // De onde veio o Atendimento: a última Transferência ou, sem ela, o que a URA já sabia.
  contexto: { origem: string; resumo: string } | null;
  mensagens: MensagemView[];
  servicos: { valor: string; rotulo: string; grupo: "contrato" | "alteracao" }[];
  setoresDestino: { valor: string; rotulo: string }[];
};

const valorDaOpcao = (d: DocumentoOferecido) => (d.data ? `${d.tipo}:${d.data}` : d.tipo);

export function documentoDaOpcao(valor: string): DocumentoDisponivel {
  const [tipo, data] = valor.split(":");
  return { tipo: tipo as DocumentoDisponivel["tipo"], data: data ?? null };
}

const FORMATO_TAMANHO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${FORMATO_TAMANHO.format(bytes / 1024)} KB`;
  return `${FORMATO_TAMANHO.format(bytes / (1024 * 1024))} MB`;
}

// A conversa é relida a cada 5 s e cada leitura gera links novos, o que recarregaria as imagens.
// Mantém o link que a leitura anterior já tinha até faltar `margemMs` para expirar.
export function reaproveitarLinks(
  nova: ConversaVista,
  anterior: ConversaVista | undefined,
  agora: number,
  margemMs = 5 * 60_000,
): ConversaVista {
  if (!anterior) return nova;
  const anteriores = new Map(anterior.mensagens.map((m) => [m.id, m.anexo]));
  return {
    ...nova,
    mensagens: nova.mensagens.map((m) => {
      const antigo = anteriores.get(m.id);
      if (!m.anexo || !antigo || Date.parse(antigo.expiraEm) - agora <= margemMs) return m;
      return { ...m, anexo: { ...m.anexo, url: antigo.url, expiraEm: antigo.expiraEm } };
    }),
  };
}

// Mesmo fuso de negócio do feed de auditoria (não o do navegador). Um formatter só, reusado por
// todas as Mensagens.
const FORMATO_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
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
    semCliente: !conversa.clienteVinculado,
    avisoInatividade: conversa.avisoInatividade,
    contexto: contextoDaConversa(conversa),
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
      anexo: m.anexo
        ? {
            tipo: m.anexo.tipo,
            nome: m.anexo.nome,
            tamanho: formatarTamanho(m.anexo.tamanho),
            url: m.anexo.url,
          }
        : null,
    })),
    setoresDestino: conversa.setoresDestino.map((setor) => ({
      valor: setor,
      rotulo: SETOR_LABEL[setor],
    })),
    // Como no menu da URA: o contrato primeiro, as alterações da mais recente para a mais antiga.
    servicos: [...conversa.documentos]
      .sort((x, y) => (x.data === null ? -1 : y.data === null ? 1 : y.data.localeCompare(x.data)))
      .map((doc) => ({ valor: valorDaOpcao(doc), rotulo: doc.descricao, grupo: doc.tipo })),
  };
}
