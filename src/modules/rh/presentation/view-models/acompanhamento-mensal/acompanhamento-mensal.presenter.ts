import type { AcompanhamentoMensalDto } from "@/modules/rh/application/dtos/acompanhamento.dto";
import type { EstadoDaCelula } from "@/presentation/components/organisms/tabela-de-acompanhamento.component";

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

const estadoDaCelula = (c: { aplica: boolean; concluido: boolean }): EstadoDaCelula =>
  !c.aplica ? "nao_aplica" : c.concluido ? "concluido" : "pendente";

export type PassoDaTroca = { tipo: "marcar" | "aplicar"; valor: boolean };

// "Se aplica" e "concluído" são dois dados; trocar o estado da célula é desmarcar antes de dispensar
// e voltar a aplicar antes de marcar, para nunca ficar concluído num serviço que não se aplica.
export function passosDaTroca(de: EstadoDaCelula, para: EstadoDaCelula): PassoDaTroca[] {
  if (de === para) return [];
  const passos: PassoDaTroca[] = [];
  if (para === "nao_aplica") {
    if (de === "concluido") passos.push({ tipo: "marcar", valor: false });
    passos.push({ tipo: "aplicar", valor: false });
    return passos;
  }
  if (de === "nao_aplica") passos.push({ tipo: "aplicar", valor: true });
  if ((de === "concluido") !== (para === "concluido")) {
    passos.push({ tipo: "marcar", valor: para === "concluido" });
  }
  return passos;
}

export type LinhaDaTabela = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  celulas: { servicoId: string; estado: EstadoDaCelula; bloqueio?: string }[];
  pendentes: number;
};

// Pendente = serviço que se aplica, não é do sistema e não está concluído.
export function linhasDaTabela(dto: AcompanhamentoMensalDto): LinhaDaTabela[] {
  const sistema = new Set(dto.servicos.filter((s) => s.sistema).map((s) => s.id));
  return dto.linhas.map((l) => {
    const celulas = l.celulas.map((c) => ({
      servicoId: c.servicoId,
      estado: estadoDaCelula(c),
      bloqueio: sistema.has(c.servicoId)
        ? "O Holerite é preenchido pelo sistema."
        : dto.podeMarcar
          ? undefined
          : "Só o Funcionário Responsável pelo cliente altera.",
    }));
    return {
      clienteId: l.clienteId,
      empresa: l.empresa,
      cnpj: l.cnpj,
      celulas,
      pendentes: l.celulas.filter((c) => c.aplica && !c.concluido && !sistema.has(c.servicoId)).length,
    };
  });
}
