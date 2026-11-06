import type {
  LerPdfDeParcelamentoInput,
  LerPdfDeParcelamentoPort,
  SugestaoDeParcelamento,
} from "@/modules/clientes/application/ports/in/ler-pdf-de-parcelamento.provider";
import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type { LeitorDeParcelamentoPort } from "@/modules/clientes/application/ports/out/leitor-de-parcelamento.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { sugerirParcelamento } from "@/modules/clientes/domain/value-objects/parcelamento.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { normalizarCnpj } from "@/shared/kernel/cnpj";
import { podeEditarCadastroOperacional } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

export class LerPdfDeParcelamento implements LerPdfDeParcelamentoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly clientes: ClienteRepository,
    private readonly leitor: LeitorDeParcelamentoPort,
  ) {}

  async execute(
    input: LerPdfDeParcelamentoInput,
  ): Promise<Result<SugestaoDeParcelamento, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeEditarCadastroOperacional(ator.papel, ator.setor)) {
      return err(
        new ForbiddenError(
          "Só Admin, Líder ou Funcionário do Simples Nacional leem o PDF do Parcelamento.",
        ),
      );
    }
    const cliente = await this.clientes.buscarPorId(input.clienteId);
    if (!cliente.ok) return cliente;
    if (!cliente.value) {
      return err(
        new NotFoundError("Não encontramos este cliente. Atualize a página e tente novamente."),
      );
    }

    const leitura = await this.leitor.ler(input.pdf);
    const sugestao = sugerirParcelamento(leitura);
    if (!sugestao.lido) return ok(sugestao);

    const cnpjLido = leitura.lido && leitura.cnpj ? normalizarCnpj(leitura.cnpj) : "";
    return ok({
      ...sugestao,
      cnpjConfere: cnpjLido ? cnpjLido === cliente.value.cnpj.valor : null,
    });
  }
}
