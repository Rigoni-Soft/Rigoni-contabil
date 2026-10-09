import type { AvisarClientePort } from "@/modules/atendimento/application/ports/in/avisar-cliente.provider";
import type {
  AtendimentoEncerrado,
  EncerrarAtendimentoPort,
} from "@/modules/atendimento/application/ports/in/encerrar-atendimento.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { avisoDeVez } from "@/modules/atendimento/domain/services/aviso-fila.service";
import { podeTransferir } from "@/modules/atendimento/domain/services/transferencia.service";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Encerrar libera o Funcionário: o repositório já o põe no cliente mais antigo da Fila (na mesma
// operação, nada fura a Fila) e aqui esse cliente é avisado. Mesma regra de quem pode agir sobre o
// Atendimento que a Transferência (dono, Líder do Setor ou Admin).
export class EncerrarAtendimento implements EncerrarAtendimentoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly avisar: AvisarClientePort,
  ) {}

  async execute({
    atendimentoId,
  }: {
    atendimentoId: string;
  }): Promise<Result<AtendimentoEncerrado, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para encerrar o Atendimento."));

    const encontrado = await this.repositorio.buscarEmAndamento(atendimentoId);
    if (!encontrado.ok) return encontrado;
    const atendimento = encontrado.value;
    if (!atendimento) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeTransferir(ator, atendimento)) {
      return err(new ForbiddenError("Você não pode encerrar este Atendimento."));
    }

    const encerrado = await this.repositorio.encerrar(atendimentoId, atendimento.funcionarioId, {
      id: ator.id,
      setor: ator.setor,
    });
    if (!encerrado.ok) return encerrado;
    if (encerrado.value.status === "inexistente") {
      return err(
        new NotFoundError("O Atendimento mudou ou foi encerrado. Atualize e tente novamente."),
      );
    }

    const proximo = encerrado.value.proximo;
    if (!proximo) return ok({ proximoDaFila: null });
    // Assumido: falhar aqui não desfaz nada; o erro diz que o cliente não foi avisado.
    const aviso = await this.avisar.execute({
      telefone: proximo.telefone,
      chave: proximo.chave,
      texto: avisoDeVez(proximo.funcionarioNome),
    });
    if (!aviso.ok) {
      return err(
        new EstadoInconsistenteError(
          "Atendimento assumido da Fila, mas o aviso ao cliente falhou.",
          proximo.id,
        ),
      );
    }
    return ok({ proximoDaFila: proximo.id });
  }
}
