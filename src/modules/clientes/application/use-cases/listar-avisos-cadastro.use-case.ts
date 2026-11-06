import type {
  CursorAvisoCadastro,
  PaginaAvisosCadastro,
} from "@/modules/clientes/application/dtos/aviso-cadastro.dto";
import type { ListarAvisosCadastroPort } from "@/modules/clientes/application/ports/in/listar-avisos-cadastro.provider";
import type { AvisosCadastroPort } from "@/modules/clientes/application/ports/out/avisos-cadastro.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const POR_PAGINA = 30;

// Cada usuário só vê os próprios avisos (RLS). Pede um a mais para saber se há próxima página.
export class ListarAvisosCadastro implements ListarAvisosCadastroPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly avisos: AvisosCadastroPort,
  ) {}

  async execute(
    cursor: CursorAvisoCadastro | null,
  ): Promise<Result<PaginaAvisosCadastro, AppError>> {
    if (!(await this.sessao.usuarioAtual())) {
      return err(new ForbiddenError("Faça login para ver os avisos."));
    }
    const lista = await this.avisos.listar(cursor, POR_PAGINA + 1);
    if (!lista.ok) return lista;

    const itens = lista.value.slice(0, POR_PAGINA);
    const ultimo = itens[POR_PAGINA - 1];
    const temMais = lista.value.length > POR_PAGINA;
    return ok({
      itens,
      proximoCursor:
        temMais && ultimo
          ? { visto: ultimo.vistoEm !== null, criadoEm: ultimo.criadoEm, id: ultimo.id }
          : null,
    });
  }
}
