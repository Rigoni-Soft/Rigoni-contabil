import type { AvisarClientePort } from "@/modules/atendimento/application/ports/in/avisar-cliente.provider";
import type {
  InatividadeVerificada,
  VerificarInatividadePort,
} from "@/modules/atendimento/application/ports/in/verificar-inatividade.provider";
import type {
  AtendimentoParaInatividade,
  AtendimentoRepositoryPort,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { FeriadosPort } from "@/modules/atendimento/application/ports/out/feriados.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import { avisoDeVez } from "@/modules/atendimento/domain/services/aviso-fila.service";
import {
  AVISO_ENCERRAMENTO_AO_CLIENTE,
  AVISO_INATIVIDADE_AO_CLIENTE,
  decidirInatividade,
  URA_ATOR_ID,
  type DecisaoInatividade,
  type Inativo,
} from "@/modules/atendimento/domain/services/inatividade.service";
import type { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Mensagens finais reivindicadas por rodada: o backlog restante entra nas próximas.
const LOTE_REENTREGA = 50;

const CONTADOR = { avisar: "avisados", cancelar: "cancelados", encerrar: "encerrados" } as const;

// Job periódico: a URA avisa quem está inativo e, sem ação, encerra o Atendimento como o
// encerramento comum (libera o Funcionário, que assume o próximo da Fila). O Funcionário continua
// dono do Atendimento até lá; o aviso a ele fica gravado no Atendimento (a tela de atendimento do
// Funcionário o lê). Um Atendimento que falha não impede os demais.
export class VerificarInatividade implements VerificarInatividadePort {
  constructor(
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly avisar: AvisarClientePort,
    private readonly relogio: RelogioPort,
    private readonly feriados: FeriadosPort,
  ) {}

  async execute(): Promise<Result<InatividadeVerificada, AppError>> {
    // Sem os feriados cadastrados o expediente sai errado: melhor não agir do que agir fora de hora.
    const extras = await this.feriados.listarDatas();
    if (!extras.ok) return extras;
    const lista = await this.repositorio.paraInatividade();
    if (!lista.ok) return lista;

    const agora = this.relogio.agora();
    const feriados = new Set(extras.value);
    const resumo: InatividadeVerificada = {
      avisados: 0,
      cancelados: 0,
      encerrados: 0,
      reentregues: 0,
      falhas: 0,
    };
    for (const atendimento of lista.value) {
      const decisao = decidirInatividade(atendimento, agora, feriados);
      if (decisao.acao === "nada") continue;
      const feito = await this.executar(decisao, atendimento);
      if (!feito.ok) resumo.falhas += 1;
      else if (feito.value) resumo[CONTADOR[decisao.acao]] += 1;
    }
    await this.reentregarEncerramentos(resumo);
    return ok(resumo);
  }

  // `true` se a ação aconteceu; `false` se não coube (outro job ou uma Mensagem chegou antes).
  private executar(
    decisao: Exclude<DecisaoInatividade, { acao: "nada" }>,
    atendimento: AtendimentoParaInatividade,
  ): Promise<Result<boolean, AppError>> {
    switch (decisao.acao) {
      case "avisar":
        return this.avisarInativo(atendimento, decisao.de);
      case "cancelar":
        return this.cancelar(atendimento);
      case "encerrar":
        return this.encerrar(atendimento);
    }
  }

  private async cancelar(
    atendimento: AtendimentoParaInatividade,
  ): Promise<Result<boolean, AppError>> {
    const limpo = await this.repositorio.limparAvisoInatividade(atendimento.id);
    return limpo.ok ? ok(true) : limpo;
  }

  // O aviso é reservado antes de sair: só quem marcou envia (duas execuções não duplicam) e a
  // marca só vale se nenhuma Mensagem entrou depois do que o job leu. Se o envio falhar a marca
  // sai, e a próxima rodada reavalia do zero. O aviso ao Funcionário é só a marca (a tela dele a
  // lê).
  private async avisarInativo(
    atendimento: AtendimentoParaInatividade,
    de: Inativo,
  ): Promise<Result<boolean, AppError>> {
    const vistoAte = ultima(atendimento);
    const reservado = await this.repositorio.marcarAvisoInatividade(atendimento.id, de, vistoAte);
    if (!reservado.ok) return reservado;
    if (!reservado.value) return ok(false);
    if (de === "funcionario") return ok(true);

    const aviso = await this.avisar.execute({
      telefone: atendimento.telefone,
      chave: atendimento.chave,
      texto: AVISO_INATIVIDADE_AO_CLIENTE,
    });
    if (!aviso.ok) {
      await this.repositorio.limparAvisoInatividade(atendimento.id);
      return aviso;
    }
    const confirmado = await this.repositorio.confirmarAvisoEntregue(atendimento.id);
    return confirmado.ok ? ok(true) : confirmado;
  }

  private async encerrar(
    atendimento: AtendimentoParaInatividade,
  ): Promise<Result<boolean, AppError>> {
    // Aviso ao cliente reservado e nunca entregue (o processo caiu entre marcar e enviar): não
    // encerra sem ele; limpa e o ciclo recomeça.
    if (atendimento.aviso?.de === "contato" && !atendimento.avisoEntregue) {
      const limpo = await this.repositorio.limparAvisoInatividade(atendimento.id);
      return limpo.ok ? ok(false) : limpo;
    }
    const encerrado = await this.repositorio.encerrarPorInatividade(
      atendimento.id,
      atendimento.funcionarioId,
      { id: URA_ATOR_ID, setor: atendimento.setor },
      AVISO_ENCERRAMENTO_AO_CLIENTE,
    );
    if (!encerrado.ok) return encerrado;
    // Mudou ou foi encerrado por outro caminho entre a leitura e agora: nada a fazer.
    if (encerrado.value.status === "inexistente") return ok(false);

    // Fechado, com a mensagem final já no histórico. Falhar nos avisos não desfaz nada: a do
    // cliente fica pendente (o job a reenvia); a do próximo da Fila aparece na contagem de falhas.
    const entregue = await this.entregarEncerramento(
      atendimento.id,
      atendimento.telefone,
      atendimento.chave,
    );
    const proximo = encerrado.value.proximo;
    const avisoDoProximo = proximo
      ? await this.avisar.execute({
          telefone: proximo.telefone,
          chave: proximo.chave,
          texto: avisoDeVez(proximo.funcionarioNome),
        })
      : ok(undefined);
    if (!entregue.ok) return entregue;
    return avisoDoProximo.ok ? ok(true) : err(avisoDoProximo.error);
  }

  private async entregarEncerramento(
    atendimentoId: string,
    telefone: string,
    chave: string,
    texto = AVISO_ENCERRAMENTO_AO_CLIENTE,
  ): Promise<Result<void, AppError>> {
    // `registrar: false`: a mensagem já foi gravada na transação do encerramento.
    const aviso = await this.avisar.execute({ telefone, chave, texto, registrar: false });
    if (!aviso.ok) {
      // Devolve a reivindicação: a próxima rodada tenta de novo, sem esperar o lease vencer.
      await this.repositorio.liberarEncerramentoPendente(atendimentoId);
      return aviso;
    }
    const confirmado = await this.repositorio.confirmarEncerramentoEntregue(atendimentoId);
    return confirmado.ok ? ok(undefined) : confirmado;
  }

  // Encerramentos de rodadas anteriores cuja mensagem final não chegou: reenvia mesmo com o
  // Atendimento já encerrado. Só o que este job reivindicou (dois jobs não enviam a mesma).
  private async reentregarEncerramentos(resumo: InatividadeVerificada): Promise<void> {
    const pendentes = await this.repositorio.reivindicarEncerramentosPendentes(LOTE_REENTREGA);
    if (!pendentes.ok) {
      resumo.falhas += 1;
      return;
    }
    for (const pendente of pendentes.value) {
      const entregue = await this.entregarEncerramento(
        pendente.atendimentoId,
        pendente.telefone,
        "",
        pendente.texto,
      );
      if (entregue.ok) resumo.reentregues += 1;
      else resumo.falhas += 1;
    }
  }
}

// A última Mensagem que o job leu (de qualquer lado): a reserva do aviso só vale sem nada depois.
function ultima({ ultimaDoContato, ultimaDoFuncionario }: AtendimentoParaInatividade): Date {
  return new Date(Math.max(ultimaDoContato?.getTime() ?? 0, ultimaDoFuncionario?.getTime() ?? 0));
}
