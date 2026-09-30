import type { SupabaseClient } from "@supabase/supabase-js";

import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import type {
  RegistroAcaoFiltro,
  RegistroAcaoRepository,
} from "@/modules/auditoria/application/ports/out/registro-acao.repository";
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

  // Devolutiva tecnica PR #60, bloqueador 01: grava via RPC (SECURITY DEFINER),
  // nunca via insert direto -- ator/criado_em sao decididos pelo banco
  // (auth.uid()/now()), nao pelo que este metodo passaria. registro.ator e
  // registro.dataHora continuam existindo no dominio (o retorno do caso de
  // uso mostra esses campos pra quem chamou), mas nao sao enviados aqui: o
  // valor que importa pra autenticidade e o que o banco decide, nao o que o
  // app calculou antes de chamar.
  async salvar(registro: RegistroAcao): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.rpc("registrar_acao_auditoria", {
      p_id: registro.id,
      p_setor: registro.setor,
      p_acao: registro.acao,
      p_alvo: registro.alvo,
      p_resultado: registro.resultado.valor,
    });

    if (error) return err(new PersistenciaError(`Falha ao gravar auditoria: ${error.message}`));
    return ok(undefined);
  }

  async listar(filtro: RegistroAcaoFiltro): Promise<Result<RegistroAcaoDto[], AppError>> {
    let query = this.supabase
      .from("registros_auditoria")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(filtro.limite);

    // ator é uuid: filtra por igualdade exata (sem busca textual, RigoniContabil ainda
    // não guarda nome legível do ator na auditoria).
    if (filtro.ator) query = query.eq("ator", filtro.ator);
    if (filtro.setor) query = query.eq("setor", filtro.setor);
    if (filtro.resultado) query = query.eq("resultado", filtro.resultado);
    if (filtro.acao) query = query.ilike("acao", `%${filtro.acao}%`);
    if (filtro.alvo) query = query.ilike("alvo", `%${filtro.alvo}%`);
    if (filtro.dataInicio) query = query.gte("criado_em", filtro.dataInicio);
    if (filtro.dataFim) query = query.lte("criado_em", filtro.dataFim);

    const { data, error } = await query;

    if (error) return err(new PersistenciaError(`Falha ao listar auditoria: ${error.message}`));

    return ok((data ?? []).map((row) => registroAcaoRowParaDto(registroAcaoRowSchema.parse(row))));
  }
}
