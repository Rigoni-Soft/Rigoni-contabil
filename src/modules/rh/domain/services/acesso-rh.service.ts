import { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import {
  ehResponsavelRhDoCliente,
  podeVerAcompanhamentoDosFuncionariosRh,
  podeVerAcompanhamentoRh,
} from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

// Acesso do RH ao Cliente e ao mês: quem pode ler, editar (mês corrente), editar mês passado ou baixar, e qual
// mês vale. Devolve ator, escopo e competência já validados; mês corrente, passado e futuro se decidem só aqui.
//   leitura: quem vê o `alcance`; mês corrente ou passado.
//   edicao: o Responsável do RH do Cliente, o Líder do RH ou o Admin; só o mês corrente.
//   edicao_retroativa: só o Líder do RH ou o Admin; mês passado (ou o corrente).
//   download: o Responsável do RH do Cliente, o Líder do RH ou o Admin; mês corrente ou passado.
// Mês futuro é sempre recusado. A RLS repete o recorte no banco.

export type FinalidadeDoAcesso = "leitura" | "edicao" | "edicao_retroativa" | "download";

// Quem entra na leitura: o RH inteiro e o Admin ("rh") ou só o Líder do RH e o Admin ("lideranca").
export type AlcanceDaLeitura = "rh" | "lideranca";

export type AtorDoRh = { id: string; papel: string; setor: string };

export type PedidoDeAcesso = {
  finalidade: FinalidadeDoAcesso;
  ator: AtorDoRh | null;
  agora: Date;
  // "AAAA-MM"; omitido = o mês corrente.
  competencia?: string;
  // Só na leitura (padrão "rh").
  alcance?: AlcanceDaLeitura;
  // Responsável do RH do Cliente alvo (edição e download); null = Cliente sem Responsável.
  responsavelDoCliente?: string | null;
  // Os textos da recusa de cada tela, para a mensagem não mudar com a migração.
  mensagens: { semAcesso: string; mesFuturo: string };
};

export type AcessoConcedido = {
  ator: AtorDoRh;
  competencia: Competencia;
  // Funcionário do RH lê só os seus Clientes: o id dele; Líder e Admin leem todos (null).
  escopo: { responsavelId: string | null };
};

const ehLiderOuAdmin = (ator: AtorDoRh) =>
  podeVerAcompanhamentoDosFuncionariosRh(ator.papel, ator.setor);

function podeNaFinalidade(pedido: PedidoDeAcesso, ator: AtorDoRh): boolean {
  switch (pedido.finalidade) {
    case "leitura":
      return pedido.alcance === "lideranca"
        ? podeVerAcompanhamentoDosFuncionariosRh(ator.papel, ator.setor)
        : podeVerAcompanhamentoRh(ator.papel, ator.setor);
    case "edicao":
    case "download":
      return ehResponsavelRhDoCliente(ator, pedido.responsavelDoCliente) || ehLiderOuAdmin(ator);
    case "edicao_retroativa":
      return ehLiderOuAdmin(ator);
  }
}

export function decidirAcesso(pedido: PedidoDeAcesso): Result<AcessoConcedido, AppError> {
  const { ator, mensagens } = pedido;
  if (!ator) {
    return err(
      new ForbiddenError(
        pedido.finalidade === "leitura" ? mensagens.semAcesso : "Sessão inválida. Entre novamente.",
      ),
    );
  }
  if (!podeNaFinalidade(pedido, ator)) return err(new ForbiddenError(mensagens.semAcesso));

  const competencia = pedido.competencia
    ? Competencia.criar(pedido.competencia)
    : ok(Competencia.atual(pedido.agora));
  if (!competencia.ok) return competencia;
  if (competencia.value.ehFutura(pedido.agora)) {
    return err(new ValidationError(mensagens.mesFuturo));
  }
  const corrente = Competencia.atual(pedido.agora).valor;
  if (pedido.finalidade === "edicao" && competencia.value.valor !== corrente) {
    return err(
      new ValidationError("Aqui só se edita o mês corrente; o mês passado é a edição retroativa."),
    );
  }

  return ok({
    ator,
    competencia: competencia.value,
    escopo: { responsavelId: ator.papel === "funcionario" ? ator.id : null },
  });
}
