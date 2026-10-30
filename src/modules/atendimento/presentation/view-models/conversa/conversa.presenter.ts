import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import { telefoneParaExibicao } from "@/presentation/lib/telefone-mask";
import type { DocumentoParaEnviar } from "@/modules/atendimento/application/ports/in/enviar-documento-ao-cliente.provider";
import type {
  ConversaVista,
  DocumentoOferecido,
  MensagemVista,
  UltimaTransferencia,
} from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { ANEXO_LINK_MARGEM_MS, type TipoAnexoMensagem } from "@/shared/kernel/anexo";
import { SETOR_LABEL } from "@/shared/kernel/setores";

export type AnexoView = {
  tipo: TipoAnexoMensagem;
  nome: string;
  // Já formatado ("1,2 MB").
  tamanho: string;
  url: string;
  urlVisualizacao: string;
  // Imagem com miniatura: a conversa mostra esta e amplia `url`.
  miniaturaUrl: string | null;
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
  // Preenchido quando o envio ao cliente não foi confirmado.
  aviso: string | null;
  anexo: AnexoView | null;
};

export type ConversaView = {
  titulo: string;
  subtitulo: string;
  encerrado: boolean;
  // Líder do Setor ou Admin lendo a conversa de outro: sem responder, serviços nem transferência.
  somenteLeitura: boolean;
  semCliente: boolean;
  // De onde veio o Atendimento: a última Transferência ou, sem ela, o que a URA já sabia.
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

// Cronômetro da gravação: 65 → "01:05".
export function formatarCronometro(segundos: number): string {
  const mm = String(Math.floor(segundos / 60)).padStart(2, "0");
  return `${mm}:${String(segundos % 60).padStart(2, "0")}`;
}

// A conversa é relida a cada 5 s e cada leitura gera links novos, o que recarregaria as imagens.
// Mantém o link que a leitura anterior já tinha até faltar `margemMs` para expirar.
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

// O polling devolve só a janela recente; o histórico já aberto é mantido, mas só se as janelas se
// sobrepõem. Sem Mensagem em comum pode haver um intervalo oculto: a janela nova vale sozinha.
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

// Histórico pedido a partir de `cursorId`. Só entra se ainda é o começo da conversa: se o polling
// trocou a janela no meio, a página não é contígua e é descartada (o "ver anteriores" refaz).
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

// Ids das Mensagens carregadas cujo link de anexo está perto de vencer. `limite` corta só os
// `elegivel`: objetos ausentes que continuam vencendo não ocupam as vagas dos válidos.
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

// Troca só os links (e a validade) dos anexos renovados; o resto da conversa não muda.
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

// Mais antiga na ordem da conversa: data e, no empate, id (o mesmo cursor da leitura no servidor).
export function antesDe(
  a: { criadoEm: string; id: string },
  b: { criadoEm: string; id: string },
): boolean {
  return a.criadoEm < b.criadoEm || (a.criadoEm === b.criadoEm && a.id < b.id);
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
    somenteLeitura: !conversa.encerrado && !conversa.podeAtender,
    semCliente: !conversa.clienteVinculado,
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
    setoresDestino: conversa.setoresDestino.map((setor) => ({
      valor: setor,
      rotulo: SETOR_LABEL[setor],
    })),
    // Já vêm na ordem do menu da URA: o contrato primeiro, as alterações por nº decrescente.
    servicos: conversa.documentos.map((doc) => ({
      valor: valorDaOpcao(doc),
      rotulo: doc.descricao,
      grupo: doc.tipo,
    })),
  };
}

// Polling da conversa aberta: rápido enquanto a conversa está acontecendo (Mensagem recente) e espaçado quando parada. Parada, a Mensagem nova do cliente aparece em até 15 s
// (o aviso global já o avisa nesse prazo) e, ao chegar, a conversa volta ao ritmo rápido.
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
