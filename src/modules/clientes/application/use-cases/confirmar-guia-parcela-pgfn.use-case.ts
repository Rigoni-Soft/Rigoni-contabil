import type {
  ConfirmarGuiaParcelaPgfnInput,
  ConfirmarGuiaParcelaPgfnPort,
} from "@/modules/clientes/application/ports/in/confirmar-guia-parcela-pgfn.provider";
import type { GuiaParcelaPgfnRepository } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { podeEditarCadastroOperacional } from "@/shared/kernel/papeis";
import { err, type Result } from "@/shared/kernel/result";

// Confirmar à mão libera a guia ao envio. Quem confirmou e quando são gravados e auditados pelo banco.
export class ConfirmarGuiaParcelaPgfn implements ConfirmarGuiaParcelaPgfnPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly guias: GuiaParcelaPgfnRepository,
  ) {}

  async execute(input: ConfirmarGuiaParcelaPgfnInput): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeEditarCadastroOperacional(ator.papel, ator.setor)) {
      return err(
        new ForbiddenError(
          "Só Admin, Líder ou Funcionário do Simples Nacional confirmam a guia da parcela.",
        ),
      );
    }
    return this.guias.confirmar(input.parcelamentoId, input.competencia);
  }
}
