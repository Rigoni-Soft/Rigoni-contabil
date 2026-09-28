import type { SupabaseClient } from "@supabase/supabase-js";

import type { ArquivoStoragePort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const BUCKET = "documentos-clientes";

class ArmazenamentoError extends AppError {
  readonly code = "ARMAZENAMENTO_ERROR";
}

export class SupabaseArquivoStorageGateway implements ArquivoStoragePort {
  constructor(private readonly supabase: SupabaseClient) {}

  async enviar(caminho: string, arquivo: File): Promise<Result<{ caminho: string }, AppError>> {
    const { error } = await this.supabase.storage.from(BUCKET).upload(caminho, arquivo);

    if (error) return err(new ArmazenamentoError(`Falha ao enviar arquivo: ${error.message}`));
    return ok({ caminho });
  }
}
