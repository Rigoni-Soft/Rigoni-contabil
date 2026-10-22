import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  AvisoCadastroDto,
  CursorAvisoCadastro,
} from "@/modules/clientes/application/dtos/aviso-cadastro.dto";
import type { AvisosCadastroPort } from "@/modules/clientes/application/ports/out/avisos-cadastro.provider";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Row da RPC: falha alto se o banco divergir (arquitetura.md §3.9).
const rowSchema = z.array(
  z.object({
    id: z.string(),
    tipo: z.enum(["novo_cliente", "nova_alteracao"]),
    cliente_id: z.string(),
    alteracao_id: z.string().nullable(),
    alteracao_numero: z.number().int().nullable(),
    criado_em: z.string(),
    visto_em: z.string().nullable(),
  }),
);

class AvisosCadastroError extends AppError {
  readonly code = "AVISOS_CADASTRO_ERROR";
}

// Sessão do usuário: a RLS de `avisos_cadastro` limita tudo aos avisos de quem está logado.
export class SupabaseAvisosCadastroGateway implements AvisosCadastroPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async listar(
    cursor: CursorAvisoCadastro | null,
    limite: number,
  ): Promise<Result<AvisoCadastroDto[], AppError>> {
    const { data, error } = await this.supabase.rpc("listar_avisos_cadastro", {
      p_limite: limite,
      p_cursor_visto: cursor?.visto ?? null,
      p_cursor_criado_em: cursor?.criadoEm ?? null,
      p_cursor_id: cursor?.id ?? null,
    });
    if (error) return err(new AvisosCadastroError("Falha ao listar os avisos."));
    const linhas = rowSchema.safeParse(data);
    if (!linhas.success) return err(new AvisosCadastroError("Resposta inesperada dos avisos."));
    return ok(
      linhas.data.map((l) => ({
        id: l.id,
        tipo: l.tipo,
        clienteId: l.cliente_id,
        alteracaoId: l.alteracao_id,
        alteracaoNumero: l.alteracao_numero,
        criadoEm: l.criado_em,
        vistoEm: l.visto_em,
      })),
    );
  }

  async contarNaoVistos(): Promise<Result<number, AppError>> {
    const { count, error } = await this.supabase
      .from("avisos_cadastro")
      .select("id", { count: "exact", head: true })
      .is("visto_em", null);
    if (error || count === null) return err(new AvisosCadastroError("Falha ao contar os avisos."));
    return ok(count);
  }

  async marcarVisto(avisoId: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.rpc("marcar_aviso_visto", { p_id: avisoId });
    if (error) return err(new AvisosCadastroError("Falha ao marcar o aviso como visto."));
    return ok(undefined);
  }
}
