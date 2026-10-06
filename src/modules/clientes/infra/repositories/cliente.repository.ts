import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

class PersistenciaError extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

export class SupabaseClienteRepository implements ClienteRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  // Cliente e suas Alterações contratuais são o mesmo agregado (raiz + entidades
  // filhas, arquitetura.md seção 3.5): gravados juntos via RPC transacional
  // (`criar_cliente`, migration deste ticket) em vez de dois inserts soltos.
  async criar(cliente: Cliente): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.rpc("criar_cliente", {
      p_id: cliente.id,
      p_empresa: cliente.empresa,
      p_cnpj: cliente.cnpj.valor,
      p_regime: cliente.regime.valor,
      p_contrato_social_caminho: cliente.contratoSocialCaminho,
      p_alteracoes: cliente.alteracoesContratuais.map((alteracao) => ({
        id: crypto.randomUUID(),
        data: alteracao.data.toISOString().slice(0, 10),
        arquivoCaminho: alteracao.arquivoCaminho,
      })),
    });

    if (error) return err(new PersistenciaError(`Falha ao salvar cliente: ${error.message}`));
    return ok(undefined);
  }
}
