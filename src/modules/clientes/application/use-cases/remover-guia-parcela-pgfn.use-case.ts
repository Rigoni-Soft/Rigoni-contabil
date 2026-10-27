import type {
  RemoverGuiaParcelaPgfnInput,
  RemoverGuiaParcelaPgfnPort,
} from "@/modules/clientes/application/ports/in/remover-guia-parcela-pgfn.provider";
import type { ArquivoStoragePort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type { GuiaParcelaPgfnRepository } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { apagarObjeto } from "@/modules/clientes/application/use-cases/guia-parcela-pgfn-compartilhado.use-case";
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
      // Resposta perdida não prova rollback, e a releitura vazia não prova remoção (a RLS pode ter
      // escondido a guia, por exemplo numa troca de Responsável): nenhum objeto é apagado sem desfecho
      // conhecido. Fica um PDF órfão no bucket privado, e quem remove confere a tela.
      if (!(removida.error instanceof ResultadoIncertoError)) return removida;
      return err(
        new EstadoInconsistenteError(
          "Não foi possível confirmar se a guia foi removida. Recarregue a página e confira antes de tentar de novo.",
          input.parcelamentoId,
        ),
      );
    }

    await apagarObjeto(
      this.storage,
      `remoção, parcelamento=${input.parcelamentoId}`,
      caminho.value,
    );
    return ok(undefined);
  }
}
