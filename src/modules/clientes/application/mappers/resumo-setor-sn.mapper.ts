import { situacaoDosParcelamentos } from "@/modules/clientes/application/mappers/parcelamentos-do-cliente";
import type {
  CardResumoSnDto,
  CorStatusResumo,
  ParcelamentoBucketDto,
} from "@/modules/clientes/application/ports/in/obter-resumo-setor-sn.provider";
import type { ResumoOperacionalRow } from "@/modules/clientes/application/ports/out/cliente-query.provider";

type Bucket = {
  id: string;
  titulo: string;
  cor: CorStatusResumo;
  pertence: (linha: ResumoOperacionalRow, agora: Date) => boolean;
  // Cards do grupo Parcelamento listam, por Cliente, a marca interno e o status do mês.
  comParcelamentos?: true;
};

const doGrupoParcelamento =
  (campo: keyof ReturnType<typeof situacaoDosParcelamentos>): Bucket["pertence"] =>
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
    cor: "andamento",
    pertence: (l) => l.dasStatus === "pronto",
  },
  {
    id: "com_parcelamento",
    titulo: "Com parcelamento",
    cor: "informativo",
    pertence: doGrupoParcelamento("comParcelamento"),
    comParcelamentos: true,
  },
  {
    id: "parcelamento_em_aberto",
    titulo: "Em aberto",
    cor: "andamento",
    pertence: doGrupoParcelamento("emAberto"),
    comParcelamentos: true,
  },
  {
    id: "parcelamento_pendente",
    titulo: "Parcelamento pendente",
    cor: "atencao",
    pertence: doGrupoParcelamento("pendente"),
    comParcelamentos: true,
  },
  {
    id: "parcelamento_pendente_atraso",
    titulo: "Pendente em atraso",
    cor: "urgente",
    pertence: doGrupoParcelamento("pendenteEmAtraso"),
    comParcelamentos: true,
  },
  {
    id: "parcelamento_interno",
    titulo: "Parcelamento interno",
    cor: "informativo",
    pertence: doGrupoParcelamento("interno"),
    comParcelamentos: true,
  },
  {
    id: "parcelamento_enviado",
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

// `agora` decide o "pendente em atraso" (dia ≥ 29 no fuso de São Paulo).
export function classificarResumoSetorSn(
  linhas: ResumoOperacionalRow[],
  agora: Date = new Date(),
): CardResumoSnDto[] {
  return BUCKETS.map((bucket) => {
    const clientes = linhas.filter((l) => bucket.pertence(l, agora));
    return {
      id: bucket.id,
      titulo: bucket.titulo,
      cor: bucket.cor,
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
