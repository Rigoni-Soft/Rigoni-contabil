import type {
  AberturaAtendimento,
  AbrirAtendimentoPort,
  AtendimentoAberto,
} from "@/modules/atendimento/application/ports/in/abrir-atendimento.provider";
import type { AvisarClientePort } from "@/modules/atendimento/application/ports/in/avisar-cliente.provider";
import type {
  AtendimentoAssumido,
  AtendimentoRepositoryPort,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import { avisoDeVez } from "@/modules/atendimento/domain/services/aviso-fila.service";
import {
  menosCarregado,
  TENTATIVAS_DE_ATRIBUICAO,
} from "@/modules/atendimento/domain/services/balanceamento.service";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Só Atendimento com Funcionário humano conta pro Balanceamento mensal: a contagem vem
// dos Atendimentos já atribuídos, a URA sozinha nunca aparece nela.
// Sem Funcionário livre o Atendimento entra na Fila (a saída é por antiguidade, ver PromoverDaFila).
// ponytail: "livre" = sem Atendimento em andamento (decidido no repositório); a regra fina de
// disponibilidade/presença não existe ainda.
export class AbrirAtendimento implements AbrirAtendimentoPort {
  constructor(
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly avisar: AvisarClientePort,
  ) {}

  async execute(abertura: AberturaAtendimento): Promise<Result<AtendimentoAberto, AppError>> {
    // O repositório recusa ("conflito") se outro Atendimento ocupou o escolhido entre a listagem e a
    // gravação; relista e escolhe de novo. Esgotadas as tentativas, abre sem atribuição.
    for (let tentativa = 0; tentativa < TENTATIVAS_DE_ATRIBUICAO; tentativa++) {
      const funcionarios = await this.repositorio.funcionariosDoSetor(abertura.setor);
      if (!funcionarios.ok) return funcionarios;
      const funcionarioId = menosCarregado(funcionarios.value)?.id ?? null;
      const aberto = await this.repositorio.abrir({
        ...abertura,
        funcionarioId,
        atribuirLivreSeVazia: funcionarioId === null,
      });
      if (!aberto.ok) return aberto;
      if (aberto.value.status === "aberto") {
        return this.concluir(aberto.value);
      }
    }
    const semAtribuicao = await this.repositorio.abrir({
      ...abertura,
      funcionarioId: null,
      atribuirLivreSeVazia: true,
    });
    if (!semAtribuicao.ok) return semAtribuicao;
    // Sem Funcionário não há o que disputar: "conflito" aqui quebra o contrato do repositório.
    if (semAtribuicao.value.status !== "aberto") {
      return err(
        new EstadoInconsistenteError(
          "Repositório recusou abrir Atendimento sem Funcionário.",
          abertura.chave,
        ),
      );
    }
    return this.concluir(semAtribuicao.value);
  }

  // O cliente mais antigo da Fila que assumiu o Funcionário antes do recém-chegado é avisado de quem
  // vai atendê-lo (o recém-chegado, que então esperou, recebe a posição do chamador).
  private async concluir(aberto: {
    id: string;
    funcionarioId: string | null;
    promovido: AtendimentoAssumido | null;
  }): Promise<Result<AtendimentoAberto, AppError>> {
    const resultado = await this.comPosicaoNaFila(aberto.id, aberto.funcionarioId);
    if (!resultado.ok || !aberto.promovido) return resultado;
    const aviso = await this.avisar.execute({
      telefone: aberto.promovido.telefone,
      chave: aberto.promovido.chave,
      texto: avisoDeVez(aberto.promovido.funcionarioNome),
    });
    if (!aviso.ok) {
      return err(
        new EstadoInconsistenteError(
          "Atendimento da Fila assumido, mas o aviso ao cliente falhou.",
          aberto.promovido.id,
        ),
      );
    }
    return resultado;
  }

  private async comPosicaoNaFila(
    id: string,
    funcionarioId: string | null,
  ): Promise<Result<AtendimentoAberto, AppError>> {
    if (funcionarioId) return ok({ id, funcionarioId });
    const posicao = await this.repositorio.posicaoNaFila(id);
    if (!posicao.ok) return posicao;
    return ok({ id, funcionarioId, ...(posicao.value ? { posicao: posicao.value } : {}) });
  }
}
