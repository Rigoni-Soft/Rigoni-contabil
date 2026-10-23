import {
  situacaoDosParcelamentos,
  type SituacaoParcelamentosDoCliente,
} from "@/modules/clientes/application/mappers/parcelamentos-do-cliente";
import type {
  CardResumoSnDto,
  CorStatusResumo,
  ParcelamentoBucketDto,
} from "@/modules/clientes/application/ports/in/obter-resumo-setor-sn.provider";
import type { ResumoOperacionalRow } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { jaEmAtraso, primeiroDiaEmAtraso } from "@/shared/kernel/dias-do-job-parcelamento";

// Texto fixo ou dependente do dia (o atraso começa no 29, ou no último dia de fevereiro comum).
type Texto = string | ((agora: Date) => string);

type Bucket = {
  id: string;
  titulo: string;
  cor: CorStatusResumo;
  descricao?: Texto;
  mensagemVazia?: Texto;
  pertence: (linha: ResumoOperacionalRow, agora: Date) => boolean;
  // Cards do grupo Parcelamento listam, por Cliente, a marca interno e o status do mês.
  comParcelamentos?: true;
};

const doGrupoParcelamento =
  (campo: keyof SituacaoParcelamentosDoCliente): Bucket["pertence"] =>
  (linha, agora) =>
    situacaoDosParcelamentos(linha, agora)[campo];

// Os 11 cards e cores do dashboard Simples Nacional. DAS: documentoObrigatorio
// aqui é o campo que a UI rotula "Documento recebido" — positivo = já recebido.
// Os 6 de Parcelamento contam Clientes e não são mutuamente exclusivos.
const BUCKETS: readonly Bucket[] = [
  {
    id: "das_emitidas",
    titulo: "DAS emitidas",
    cor: "em_dia",
    pertence: (l) => l.dasStatus === "enviado",
  },
  {
    id: "sem_documento",
    titulo: "Sem documento",
    cor: "atencao",
    pertence: (l) => l.documentoObrigatorio === "negativo",
  },
  {
    // Urgente só quando o documento já chegou e a DAS segue pendente — sem
    // documento, o backlog já está contado no card "Sem documento".
    id: "das_pendente",
    titulo: "DAS pendente",
    cor: "urgente",
    pertence: (l) => l.dasStatus === "pendente" && l.documentoObrigatorio === "positivo",
  },
  {
    id: "sem_movimento",
    titulo: "Sem movimento",
    cor: "informativo",
    pertence: (l) => l.dasStatus === "sem_movimento",
  },
  {
    id: "esperando_envio_das",
    titulo: "Esperando envio DAS",
    cor: "atencao",
    pertence: (l) => l.dasStatus === "pronto",
  },
  {
    id: "com_parcelamento",
    descricao: "Clientes com algum parcelamento cadastrado, em aberto ou quitado.",
    mensagemVazia: "Nenhum cliente com parcelamento cadastrado.",
    titulo: "Com parcelamento",
    cor: "informativo",
    pertence: doGrupoParcelamento("comParcelamento"),
    comParcelamentos: true,
  },
  {
    id: "parcelamento_em_aberto",
    descricao: "Clientes com algum parcelamento ainda não quitado.",
    mensagemVazia: "Nenhum cliente com parcelamento em aberto.",
    titulo: "Em aberto",
    cor: "andamento",
    pertence: doGrupoParcelamento("emAberto"),
    comParcelamentos: true,
  },
  {
    id: "parcelamento_pendente",
    descricao: "Clientes com parcelamento em aberto cuja guia deste mês ainda não foi enviada.",
    mensagemVazia:
      "Nenhum cliente com guia pendente neste mês: todas as guias dos parcelamentos em aberto já foram enviadas.",
    titulo: "Parcelamento pendente",
    cor: "atencao",
    pertence: doGrupoParcelamento("pendente"),
    comParcelamentos: true,
  },
  {
    id: "parcelamento_pendente_atraso",
    descricao: (agora) =>
      `Clientes com guia de parcelamento pendente a partir do dia ${primeiroDiaEmAtraso(agora)}, depois da última rodada de envio do mês.`,
    mensagemVazia: (agora) =>
      jaEmAtraso(agora)
        ? "Nenhum cliente em atraso: todas as guias pendentes foram enviadas."
        : "Nenhum cliente em atraso por enquanto.",
    titulo: "Pendente em atraso",
    cor: "urgente",
    pertence: doGrupoParcelamento("pendenteEmAtraso"),
    comParcelamentos: true,
  },
  {
    id: "parcelamento_interno",
    descricao:
      "Clientes com parcelamento interno em aberto: a guia vai ao financeiro, não ao cliente.",
    mensagemVazia: "Nenhum cliente com parcelamento interno em aberto.",
    titulo: "Parcelamento interno",
    cor: "informativo",
    pertence: doGrupoParcelamento("interno"),
    comParcelamentos: true,
  },
  {
    id: "parcelamento_enviado",
    descricao: "Clientes cujos parcelamentos em aberto já tiveram a guia deste mês enviada.",
    mensagemVazia: "Nenhum cliente com todas as guias do mês enviadas ainda.",
    titulo: "Parcelamento enviado",
    cor: "em_dia",
    pertence: doGrupoParcelamento("enviado"),
    comParcelamentos: true,
  },
] as const;

const parcelamentosDaLista = (linha: ResumoOperacionalRow): ParcelamentoBucketDto[] =>
  linha.parcelamentos.map((p) => ({
    codigo: p.codigo,
    interno: p.interno,
    status: p.quitado ? "quitado" : p.enviadoNoMes ? "enviado" : "pendente",
  }));

const texto = (t: Texto | undefined, agora: Date) => (typeof t === "function" ? t(agora) : t);

// `agora` decide o "pendente em atraso" (dia ≥ 29 no fuso de São Paulo).
export function classificarResumoSetorSn(
  linhas: ResumoOperacionalRow[],
  agora: Date,
): CardResumoSnDto[] {
  return BUCKETS.map((bucket) => {
    const clientes = linhas.filter((l) => bucket.pertence(l, agora));
    return {
      id: bucket.id,
      titulo: bucket.titulo,
      cor: bucket.cor,
      descricao: texto(bucket.descricao, agora),
      mensagemVazia: texto(bucket.mensagemVazia, agora),
      quantidade: clientes.length,
      clientes: clientes.map((c) => ({
        clienteId: c.clienteId,
        empresa: c.empresa,
        cnpj: c.cnpj,
        ...(bucket.comParcelamentos && { parcelamentos: parcelamentosDaLista(c) }),
      })),
    };
  });
}
