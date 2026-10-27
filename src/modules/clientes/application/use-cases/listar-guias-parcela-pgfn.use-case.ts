import type { ListarGuiasParcelaPgfnPort } from "@/modules/clientes/application/ports/in/listar-guias-parcela-pgfn.provider";
import type {
  GuiaDaParcela,
  GuiaParcelaPgfnRepository,
} from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Sem checagem de papel: a RLS do Parcelamento decide quem enxerga as guias.
export class ListarGuiasParcelaPgfn implements ListarGuiasParcelaPgfnPort {
  constructor(private readonly guias: GuiaParcelaPgfnRepository) {}

  execute(parcelamentoId: string): Promise<Result<GuiaDaParcela[], AppError>> {
    return this.guias.listar(parcelamentoId);
  }
}
