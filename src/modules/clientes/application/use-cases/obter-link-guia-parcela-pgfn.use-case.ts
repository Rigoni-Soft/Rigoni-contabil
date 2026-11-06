import type {
  ObterLinkGuiaParcelaPgfnInput,
  ObterLinkGuiaParcelaPgfnPort,
} from "@/modules/clientes/application/ports/in/obter-link-guia-parcela-pgfn.provider";
import type { ArquivoComLinkPort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type { GuiaParcelaPgfnRepository } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const VALIDADE_LINK_SEGUNDOS = 120;

// O caminho nasce da leitura pela sessão do usuário (RLS do Parcelamento), nunca da tela: quem não vê
// o Parcelamento não gera link, e "não existe" e "sem acesso" são indistinguíveis de propósito.
export class ObterLinkGuiaParcelaPgfn implements ObterLinkGuiaParcelaPgfnPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly guias: GuiaParcelaPgfnRepository,
    private readonly storage: ArquivoComLinkPort,
  ) {}

  async execute(input: ObterLinkGuiaParcelaPgfnInput): Promise<Result<{ url: string }, AppError>> {
    if (!(await this.sessao.usuarioAtual())) {
      return err(new ForbiddenError("Faça login para abrir a guia."));
    }
    const caminho = await this.guias.arquivo(input.parcelamentoId, input.competencia);
    if (!caminho.ok) return caminho;
    if (!caminho.value) return err(new NotFoundError("Guia não encontrada."));
    const link = await this.storage.linkTemporario(caminho.value, VALIDADE_LINK_SEGUNDOS);
    return link.ok ? ok({ url: link.value }) : link;
  }
}
