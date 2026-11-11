import type { SupabaseClient } from "@supabase/supabase-js";

import type { ArmazenamentoDeConvencaoPort } from "@/modules/rh/application/ports/out/armazenamento-de-convencao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const BUCKET = "convencoes-coletivas";

// O client é o de serviço (o bucket não tem policy para o usuário); o caso de uso autoriza antes.
export class SupabaseArmazenamentoDeConvencaoGateway implements ArmazenamentoDeConvencaoPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async enviar(caminho: string, pdf: Uint8Array): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.storage
      .from(BUCKET)
      .upload(caminho, pdf, { contentType: "application/pdf" });
    if (error) return err(new PersistenciaError("Não foi possível guardar o PDF da convenção."));
    return ok(undefined);
  }

  async remover(caminho: string): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase.storage.from(BUCKET).remove([caminho]);
    // Sem o objeto o Storage devolve lista vazia, sem erro: conferir a contagem.
    if (error || data?.length !== 1) {
      return err(new PersistenciaError("Não foi possível remover o PDF da convenção."));
    }
    return ok(undefined);
  }
}
