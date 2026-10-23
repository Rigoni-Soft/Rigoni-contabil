import type {
  LerPdfDeParcelamentoPort,
  SugestaoDeParcelamento,
} from "@/modules/clientes/application/ports/in/ler-pdf-de-parcelamento.provider";
import type { LeitorDeParcelamentoPort } from "@/modules/clientes/application/ports/out/leitor-de-parcelamento.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { sugerirParcelamento } from "@/modules/clientes/domain/value-objects/parcelamento.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { podeEditarCadastroOperacional } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

export class LerPdfDeParcelamento implements LerPdfDeParcelamentoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly leitor: LeitorDeParcelamentoPort,
  ) {}

  async execute(input: { pdf: Uint8Array }): Promise<Result<SugestaoDeParcelamento, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeEditarCadastroOperacional(ator.papel, ator.setor)) {
      return err(
        new ForbiddenError(
          "Só Admin, Líder ou Funcionário do Simples Nacional leem o PDF do Parcelamento.",
        ),
      );
    }
    return ok(sugerirParcelamento(await this.leitor.ler(input.pdf)));
  }
}
