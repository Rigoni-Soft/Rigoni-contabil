import type { AcompanhamentoMensalDto } from "@/modules/rh/application/dtos/acompanhamento.dto";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function rotuloDaCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}

// Os últimos `quantos` meses até o corrente (mais recente primeiro), para o seletor.
export function mesesParaSeletor(atual: string, quantos = 12): { valor: string; rotulo: string }[] {
  const [ano, mes] = atual.split("-").map(Number);
  return Array.from({ length: quantos }, (_, i) => {
    const data = new Date(Date.UTC(ano, mes - 1 - i, 1));
    const valor = `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
    return { valor, rotulo: rotuloDaCompetencia(valor) };
  });
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
