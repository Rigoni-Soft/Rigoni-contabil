import type { SupabaseClient } from "@supabase/supabase-js";

import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import type { RegistroAcaoRepository } from "@/modules/auditoria/application/ports/out/registro-acao.repository";
import type { RegistroAcao } from "@/modules/auditoria/domain/entities/registro-acao.entity";
import { registroAcaoRowSchema } from "@/modules/auditoria/infra/dtos/registro-acao-row.dto";
import { registroAcaoRowParaDto } from "@/modules/auditoria/infra/mappers/registro-acao-row-para-dto.mapper";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

class PersistenciaError extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

export class SupabaseRegistroAcaoRepository implements RegistroAcaoRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async salvar(registro: RegistroAcao): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.from("registros_auditoria").insert({
      id: registro.id,
      ator: registro.ator,
      setor: registro.setor,
      acao: registro.acao,
      alvo: registro.alvo,
      resultado: registro.resultado.valor,
      criado_em: registro.dataHora.toISOString(),
    });

    if (error) return err(new PersistenciaError(`Falha ao gravar auditoria: ${error.message}`));
    return ok(undefined);
  }

  async listarRecentes(limite: number): Promise<RegistroAcaoDto[]> {
    const { data, error } = await this.supabase
      .from("registros_auditoria")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(limite);

    if (error) throw new Error(`Falha ao listar auditoria: ${error.message}`);

    return (data ?? []).map((row) => registroAcaoRowParaDto(registroAcaoRowSchema.parse(row)));
  }
}
