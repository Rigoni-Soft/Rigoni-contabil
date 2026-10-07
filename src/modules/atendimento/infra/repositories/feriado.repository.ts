import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  FeriadoDto,
  FeriadoRepositoryPort,
} from "@/modules/atendimento/application/ports/out/feriado.repository";
import type { FeriadosPort } from "@/modules/atendimento/application/ports/out/feriados.provider";
import type { AppError } from "@/shared/errors/app.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const UNIQUE_VIOLATION = "23505";

// Com o client da sessão do Admin a RLS e a auditoria do banco valem; com o service_role (webhook)
// só `listarDatas` é usado.
export class SupabaseFeriadoRepository implements FeriadoRepositoryPort, FeriadosPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async listar(): Promise<Result<FeriadoDto[], AppError>> {
    const { data, error } = await this.supabase
      .from("feriados")
      .select("data, descricao")
      .order("data");
    if (error) return err(new ServicoExternoError("Falha ao consultar os feriados."));
    return ok(data as FeriadoDto[]);
  }

  async listarDatas(): Promise<Result<string[], AppError>> {
    const feriados = await this.listar();
    return feriados.ok ? ok(feriados.value.map((f) => f.data)) : feriados;
  }

  async cadastrar(feriado: FeriadoDto): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.from("feriados").insert(feriado);
    if (error?.code === UNIQUE_VIOLATION) {
      return err(new ValidationError("Já existe um feriado cadastrado nessa data."));
    }
    return error ? err(new ServicoExternoError("Falha ao cadastrar o feriado.")) : ok(undefined);
  }

  async remover(data: string): Promise<Result<void, AppError>> {
    const { data: removidos, error } = await this.supabase
      .from("feriados")
      .delete()
      .eq("data", data)
      .select("data");
    if (error) return err(new ServicoExternoError("Falha ao remover o feriado."));
    return removidos.length === 0
      ? err(new NotFoundError("Feriado não encontrado."))
      : ok(undefined);
  }
}
