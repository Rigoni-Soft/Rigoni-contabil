import type {
  RemoverGuiaParcelaPgfnInput,
  RemoverGuiaParcelaPgfnPort,
} from "@/modules/clientes/application/ports/in/remover-guia-parcela-pgfn.provider";
import type { ArquivoStoragePort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type { GuiaParcelaPgfnRepository } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { podeEditarCadastroOperacional } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

// Remove a guia ainda não enviada (o banco recusa a de competência já enviada). O objeto só é apagado
// depois de o banco aceitar a remoção; falha ao apagá-lo deixa PDF órfão em bucket privado, sem
// desfazer o que já foi removido.
export class RemoverGuiaParcelaPgfn implements RemoverGuiaParcelaPgfnPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly guias: GuiaParcelaPgfnRepository,
    private readonly storage: ArquivoStoragePort,
  ) {}

  async execute(input: RemoverGuiaParcelaPgfnInput): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeEditarCadastroOperacional(ator.papel, ator.setor)) {
      return err(
        new ForbiddenError(
          "Só Admin, Líder ou Funcionário do Simples Nacional removem a guia da parcela.",
        ),
      );
    }

    const caminho = await this.guias.arquivo(input.parcelamentoId, input.competencia);
    if (!caminho.ok) return caminho;
    if (!caminho.value) {
      return err(new NotFoundError("Não encontramos esta guia. Atualize a página."));
    }

    const removida = await this.guias.remover(input.parcelamentoId, input.competencia);
    if (!removida.ok) {
      // Resposta perdida não prova rollback: só a leitura mostrando a guia ausente libera o objeto.
      if (!(removida.error instanceof ResultadoIncertoError)) return removida;
      const depois = await this.guias.arquivo(input.parcelamentoId, input.competencia);
      if (!depois.ok || depois.value) {
        return err(
          new EstadoInconsistenteError(
            "Não foi possível confirmar se a guia foi removida. Recarregue a página e confira antes de tentar de novo.",
            input.parcelamentoId,
          ),
        );
      }
    }

    const apagado = await this.storage.remover([caminho.value]);
    if (!apagado.ok) {
      console.error(
        `Falha ao remover o PDF da guia (parcelamento=${input.parcelamentoId}, caminho=${caminho.value}):`,
        apagado.error.message,
      );
    }
    return ok(undefined);
  }
}
