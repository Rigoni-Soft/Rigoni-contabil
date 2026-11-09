import type { EstadoDoServico } from "@/presentation/components/organisms/acompanhamento-do-cliente-rh.component";
import type { AcompanhamentoMensalDto } from "@/modules/rh/application/dtos/acompanhamento.dto";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
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

const estadoDoServico = (c: { aplica: boolean; concluido: boolean }): EstadoDoServico =>
  !c.aplica ? "nao_aplica" : c.concluido ? "concluido" : "pendente";

// Os links de mês do painel do Cliente: o próximo some no mês corrente. Preserva `voltarPara`.
export function linksDoMes(
  clienteId: string,
  competencia: string,
  atual: string,
  voltarPara?: string,
) {
  const href = (delta: number) =>
    `/clientes/${encodeURIComponent(clienteId)}?mes=${mesVizinho(competencia, delta)}${
      voltarPara ? `&voltarPara=${encodeURIComponent(voltarPara)}` : ""
    }`;
  return { anteriorHref: href(-1), proximoHref: competencia < atual ? href(1) : undefined };
}

export type PassoDaTroca = { tipo: "marcar" | "aplicar"; valor: boolean };

// "Se aplica" e "concluído" são dois dados; trocar o estado da célula é desmarcar antes de dispensar
// e voltar a aplicar antes de marcar, para nunca ficar concluído num serviço que não se aplica.
export function passosDaTroca(de: EstadoDoServico, para: EstadoDoServico): PassoDaTroca[] {
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

// Os serviços do mês de um Cliente, na ordem das colunas. undefined = o Cliente não está na vista do ator
// (sem Responsável do RH, ou de outro Funcionário), e o painel dele não mostra o acompanhamento.
export function servicosDoCliente(dto: AcompanhamentoMensalDto, clienteId: string) {
  const linha = dto.linhas.find((l) => l.clienteId === clienteId);
  if (!linha) return undefined;
  const sistema = new Set(dto.servicos.filter((s) => s.sistema).map((s) => s.id));
  return linha.celulas.map((c) => ({
    servicoId: c.servicoId,
    nome: dto.servicos.find((s) => s.id === c.servicoId)?.nome ?? "",
    estado: estadoDoServico(c),
    bloqueio: sistema.has(c.servicoId)
      ? "O Holerite é preenchido pelo sistema."
      : dto.podeMarcar
        ? undefined
        : "Só o Funcionário Responsável pelo cliente altera.",
  }));
}
