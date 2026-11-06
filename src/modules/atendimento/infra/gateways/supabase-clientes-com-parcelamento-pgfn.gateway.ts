import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  ClienteComParcelamentoPgfn,
  ClientesComParcelamentoPgfnPort,
} from "@/modules/atendimento/application/ports/out/clientes-com-parcelamento-pgfn.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { lerTodasAsPaginas, TAMANHO_DA_PAGINA } from "@/shared/kernel/paginacao-por-cursor";
import { err, ok, type Result } from "@/shared/kernel/result";

const linhaSchema = z.object({
  cliente_id: z.string(),
  empresa: z.string(),
  pendencias: z.array(
    z.object({ codigo: z.string(), estado: z.enum(["sem_guia", "a_confirmar"]) }),
  ),
});

// Usa o client service_role (docs/adr/0001): o job não tem sessão de usuário.
export class SupabaseClientesComParcelamentoPgfnGateway implements ClientesComParcelamentoPgfnPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async listar(): Promise<Result<ClienteComParcelamentoPgfn[], AppError>> {
    const linhas = await lerTodasAsPaginas(
      async (apos) => {
        const { data, error } = await this.supabaseAdmin.rpc("clientes_com_parcelamento_pgfn", {
          p_apos: apos,
          p_limite: TAMANHO_DA_PAGINA,
        });
        const lidas = z.array(linhaSchema).safeParse(data);
        return error || !lidas.success ? null : lidas.data;
      },
      (linha) => linha.cliente_id,
    );
    if (!linhas) {
      return err(new ServicoExternoError("Falha ao ler os Clientes com Parcelamento PGFN."));
    }
    return ok(
      linhas.map((l) => ({
        clienteId: l.cliente_id,
        empresa: l.empresa,
        pendencias: l.pendencias,
      })),
    );
  }
}
