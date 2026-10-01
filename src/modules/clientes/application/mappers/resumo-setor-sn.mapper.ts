import type {
  CardResumoSnDto,
  CorStatusResumo,
} from "@/modules/clientes/application/ports/in/obter-resumo-setor-sn.provider";
import type { ResumoOperacionalRow } from "@/modules/clientes/application/ports/out/cliente-query.provider";

type Bucket = {
  id: string;
  titulo: string;
  cor: CorStatusResumo;
  pertence: (linha: ResumoOperacionalRow) => boolean;
};

// Os 9 cards e cores da spec #24 (seção "Dashboard Simples Nacional" —
// protótipo aprovado). DAS: documentoObrigatorio aqui é o campo que a UI
// rotula "Documento recebido" (#34) — positivo = já recebido.
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
    // documento, o backlog já está contado no card "Sem documento" (job #42
    // da spec #24 só alerta nesse caso, mesmo critério usado aqui).
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
    pertence: (l) => l.temParcelamento,
  },
  {
    id: "parcelamento_pendente",
    titulo: "Parcelamento pendente",
    cor: "urgente",
    pertence: (l) => l.temParcelamento && l.parcelamentoStatus === "pendente",
  },
  {
    id: "parcelamento_interno",
    titulo: "Parcelamento interno",
    cor: "informativo",
    pertence: (l) => l.temParcelamento && l.parcelamentoStatus === "interno",
  },
  {
    id: "parcelamento_enviado",
    titulo: "Parcelamento enviado",
    cor: "em_dia",
    pertence: (l) => l.temParcelamento && l.parcelamentoStatus === "enviado",
  },
] as const;

export function classificarResumoSetorSn(linhas: ResumoOperacionalRow[]): CardResumoSnDto[] {
  return BUCKETS.map((bucket) => {
    const clientes = linhas.filter(bucket.pertence);
    return {
      id: bucket.id,
      titulo: bucket.titulo,
      cor: bucket.cor,
      quantidade: clientes.length,
      clientes: clientes.map((c) => ({
        clienteId: c.clienteId,
        empresa: c.empresa,
        cnpj: c.cnpj,
      })),
    };
  });
}
