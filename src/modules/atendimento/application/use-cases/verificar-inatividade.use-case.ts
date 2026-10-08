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
    const resumo: InatividadeVerificada = { avisados: 0, cancelados: 0, encerrados: 0, falhas: 0 };
    for (const atendimento of lista.value) {
      const decisao = decidirInatividade(atendimento, agora, feriados);
      if (decisao.acao === "nada") continue;
      const feito = await this.executar(decisao, atendimento);
      resumo[feito.ok ? CONTADOR[decisao.acao] : "falhas"] += 1;
    }
    return ok(resumo);
  }

  private executar(
    decisao: Exclude<DecisaoInatividade, { acao: "nada" }>,
    atendimento: AtendimentoParaInatividade,
  ): Promise<Result<void, AppError>> {
    switch (decisao.acao) {
      case "avisar":
        return this.avisarInativo(atendimento, decisao.de);
      case "cancelar":
        return this.repositorio.limparAvisoInatividade(atendimento.id);
      case "encerrar":
        return this.encerrar(atendimento);
    }
  }

  // O aviso ao cliente sai antes da marca: se o envio falhar nada é marcado e a próxima rodada
  // tenta de novo; se só a marca falhar, o aviso se repete (melhor que encerrar sem ter avisado).
  // O aviso ao Funcionário é só a marca (a tela dele a lê).
  private async avisarInativo(
    atendimento: AtendimentoParaInatividade,
    de: Inativo,
  ): Promise<Result<void, AppError>> {
    if (de === "contato") {
      const aviso = await this.avisar.execute({
        telefone: atendimento.telefone,
        chave: atendimento.chave,
        texto: AVISO_INATIVIDADE_AO_CLIENTE,
      });
      if (!aviso.ok) return aviso;
    }
    const marcado = await this.repositorio.marcarAvisoInatividade(atendimento.id, de);
    return marcado.ok ? ok(undefined) : marcado;
  }

  private async encerrar(atendimento: AtendimentoParaInatividade): Promise<Result<void, AppError>> {
    const encerrado = await this.repositorio.encerrarPorInatividade(
      atendimento.id,
      atendimento.funcionarioId,
      {
        id: URA_ATOR_ID,
        setor: atendimento.setor,
      },
    );
    if (!encerrado.ok) return encerrado;
    // Mudou ou foi encerrado por outro caminho entre a leitura e agora: nada a fazer.
    if (encerrado.value.status === "inexistente") return ok(undefined);

    // Assumido: falhar nos avisos não desfaz nada; a falha só aparece na contagem.
    const aviso = await this.avisar.execute({
      telefone: atendimento.telefone,
      chave: atendimento.chave,
      texto: AVISO_ENCERRAMENTO_AO_CLIENTE,
    });
    const proximo = encerrado.value.proximo;
    const avisoDoProximo = proximo
      ? await this.avisar.execute({
          telefone: proximo.telefone,
          chave: proximo.chave,
          texto: avisoDeVez(proximo.funcionarioNome),
        })
      : ok(undefined);
    return !aviso.ok ? aviso : avisoDoProximo.ok ? ok(undefined) : err(avisoDoProximo.error);
  }
}
