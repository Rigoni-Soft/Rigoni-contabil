import type { EstadoDoServico } from "@/presentation/components/organisms/acompanhamento-do-cliente-rh.component";
import type {
  AcompanhamentoMensalDto,
  EscopoDoAplica,
  HoleriteDaLinhaDto,
} from "@/modules/rh/application/dtos/acompanhamento.dto";
import { mesVizinho } from "@/shared/kernel/mes-atual";

const MES_POR_EXTENSO = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });

export function rotuloDaCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${MES_POR_EXTENSO.format(Date.UTC(ano, mes - 1, 1))} de ${ano}`;
}

const estadoDoServico = (c: {
  aplica: boolean;
  sempre: boolean;
  concluido: boolean;
}): EstadoDoServico => {
  if (!c.aplica) return c.sempre ? "nunca_aplica" : "nao_aplica";
  return c.concluido ? "concluido" : "pendente";
};

const plural = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`;

// "Cadastrados x cartões feitos" do cliente, o que falta para o Holerite. Sem empregados, não há Holerite.
export function resumoDoHolerite(h: HoleriteDaLinhaDto): string {
  if (h.cadastrados === 0) return "Sem empregados cadastrados: não há Holerite a cumprir.";
  const { exigidos } = h;
  const semMovimento = h.semMovimento > 0 ? `, ${h.semMovimento} sem movimento` : "";
  return `${plural(h.cadastrados, "empregado cadastrado", "empregados cadastrados")}${semMovimento} · ${h.cartoes} de ${plural(exigidos, "cartão", "cartões")} ${exigidos === 1 ? "feito" : "feitos"} no mês`;
}

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

export type PassoDaTroca =
  { tipo: "marcar"; valor: boolean } | { tipo: "aplicar"; escopo: EscopoDoAplica };

// "Se aplica" e "concluído" são dois dados; trocar o estado da célula é desmarcar antes de dispensar
// e voltar a aplicar antes de marcar, para nunca ficar concluído num serviço que não se aplica.
export function passosDaTroca(de: EstadoDoServico, para: EstadoDoServico): PassoDaTroca[] {
  if (de === para) return [];
  const passos: PassoDaTroca[] = [];
  if (para === "nao_aplica" || para === "nunca_aplica") {
    if (de === "concluido") passos.push({ tipo: "marcar", valor: false });
    passos.push({ tipo: "aplicar", escopo: para === "nunca_aplica" ? "sempre" : "mes" });
    return passos;
  }
  if (de === "nao_aplica" || de === "nunca_aplica")
    passos.push({ tipo: "aplicar", escopo: "aplica" });
  if ((de === "concluido") !== (para === "concluido")) {
    passos.push({ tipo: "marcar", valor: para === "concluido" });
  }
  return passos;
}

// Os serviços do mês de um Cliente, na ordem das colunas. Sem linha na vista (sem Responsável do RH), todos
// aparecem pendentes e bloqueados, com `aviso`: o Líder vê o que acompanhará e atribui o Responsável.
// O texto é neutro porque "sem linha" também cobre cliente de outro Funcionário.
const AVISO_SEM_VISTA =
  "Este cliente não está na sua vista do RH. Só o Responsável marca; o Líder atribui o Responsável no cadastro.";
export function servicosDoCliente(dto: AcompanhamentoMensalDto, clienteId: string) {
  const linha = dto.linhas.find((l) => l.clienteId === clienteId);
  const sistema = new Set(dto.servicos.filter((s) => s.sistema).map((s) => s.id));
  const bloqueioDe = (id: string) =>
    sistema.has(id)
      ? "O Holerite é preenchido pelo sistema."
      : !linha
        ? AVISO_SEM_VISTA
        : dto.podeMarcar
          ? undefined
          : "Só o Funcionário Responsável pelo cliente altera.";
  const celulas =
    linha?.celulas ??
    dto.servicos.map((s) => ({ servicoId: s.id, aplica: true, sempre: false, concluido: false }));
  const servicos = celulas.map((c) => ({
    servicoId: c.servicoId,
    nome: dto.servicos.find((s) => s.id === c.servicoId)?.nome ?? "",
    estado: estadoDoServico(c),
    bloqueio: bloqueioDe(c.servicoId),
    // O Holerite mostra empregados cadastrados x cartões feitos, na própria linha dele.
    detalhe: linha && sistema.has(c.servicoId) ? resumoDoHolerite(linha.holerite) : undefined,
  }));
  return { servicos, aviso: linha ? undefined : AVISO_SEM_VISTA };
}
