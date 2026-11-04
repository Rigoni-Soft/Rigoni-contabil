import type { AcompanhamentoMensalDto } from "@/modules/rh/application/dtos/acompanhamento.dto";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function rotuloDaCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}

// Mês vizinho ("AAAA-MM"): delta -1 = anterior, +1 = próximo.
export function mesVizinho(competencia: string, delta: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1 + delta, 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type LinhaDaTabela = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  celulas: { servicoId: string; aplica: boolean; concluido: boolean; editavel: boolean }[];
  pendentes: number;
};

// Pendente = serviço que se aplica, não é do sistema e não está concluído.
export function linhasDaTabela(dto: AcompanhamentoMensalDto): LinhaDaTabela[] {
  const sistema = new Set(dto.servicos.filter((s) => s.sistema).map((s) => s.id));
  return dto.linhas.map((l) => {
    const celulas = l.celulas.map((c) => ({
      ...c,
      editavel: dto.podeMarcar && !sistema.has(c.servicoId),
    }));
    return {
      clienteId: l.clienteId,
      empresa: l.empresa,
      cnpj: l.cnpj,
      celulas,
      pendentes: celulas.filter((c) => c.aplica && !c.concluido && !sistema.has(c.servicoId)).length,
    };
  });
}
