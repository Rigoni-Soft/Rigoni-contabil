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
  type Inativo,
} from "@/modules/atendimento/domain/services/inatividade.service";
import type { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

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
      const decisao = decidirInatividade(
        {
          ultimaDoContato: atendimento.ultimaDoContato,
          ultimaDoFuncionario: atendimento.ultimaDoFuncionario,
          aviso: atendimento.aviso,
        },
        agora,
        feriados,
      );
      if (decisao.acao === "nada") continue;
      const feito =
        decisao.acao === "avisar"
          ? await this.avisarInativo(atendimento, decisao.de)
          : decisao.acao === "cancelar"
            ? await this.repositorio.limparAvisoInatividade(atendimento.id)
            : await this.encerrar(atendimento);
      if (!feito.ok) resumo.falhas += 1;
      else if (decisao.acao === "avisar") resumo.avisados += 1;
      else if (decisao.acao === "cancelar") resumo.cancelados += 1;
      else resumo.encerrados += 1;
    }
    return ok(resumo);
  }

  private async avisarInativo(
    atendimento: AtendimentoParaInatividade,
    de: Inativo,
  ): Promise<Result<void, AppError>> {
    const marcado = await this.repositorio.marcarAvisoInatividade(atendimento.id, de);
    if (!marcado.ok) return marcado;
    if (!marcado.value || de === "funcionario") return ok(undefined);
    const aviso = await this.avisar.execute({
      telefone: atendimento.telefone,
      chave: atendimento.chave,
      texto: AVISO_INATIVIDADE_AO_CLIENTE,
    });
    if (aviso.ok) return aviso;
    // Sem o aviso entregue o cliente não pode ser encerrado: desfaz a marca e a próxima rodada tenta.
    await this.repositorio.limparAvisoInatividade(atendimento.id);
    return aviso;
  }

  private async encerrar(atendimento: AtendimentoParaInatividade): Promise<Result<void, AppError>> {
    const encerrado = await this.repositorio.encerrar(atendimento.id, atendimento.funcionarioId, {
      id: URA_ATOR_ID,
      setor: atendimento.setor,
    });
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
