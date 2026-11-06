import type { AvisarClientePort } from "@/modules/atendimento/application/ports/in/avisar-cliente.provider";
import type { EncerrarAtendimentoPort } from "@/modules/atendimento/application/ports/in/encerrar-atendimento.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { RegistroDeErrosPort } from "@/modules/atendimento/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { AVISO_ENCERRAMENTO_AO_CLIENTE } from "@/modules/atendimento/domain/services/aviso-fila.service";
import { podeSupervisionar } from "@/modules/atendimento/domain/services/transferencia.service";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Mesma regra de quem pode agir sobre o Atendimento que a Transferência (dono, Líder do Setor ou
// Admin). Encerrar não puxa ninguém da espera.
export class EncerrarAtendimento implements EncerrarAtendimentoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly avisar: AvisarClientePort,
    private readonly erros: RegistroDeErrosPort,
  ) {}

  async execute({ atendimentoId }: { atendimentoId: string }): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para encerrar o Atendimento."));

    const encontrado = await this.repositorio.buscarEmAndamento(atendimentoId);
    if (!encontrado.ok) return encontrado;
    const atendimento = encontrado.value;
    if (!atendimento) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeSupervisionar(ator, atendimento)) {
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

    // Já encerrado: falhar no aviso não desfaz nada, e a despedida não vale um erro para quem encerrou.
    const aviso = await this.avisar.execute({
      telefone: atendimento.telefone,
      chave: atendimento.chave,
      texto: AVISO_ENCERRAMENTO_AO_CLIENTE,
    });
    if (!aviso.ok) {
      this.erros.registrar(
        `Atendimento ${atendimentoId} encerrado, mas o aviso ao cliente falhou:`,
        aviso.error.message,
      );
    }
    return ok(undefined);
  }
}
