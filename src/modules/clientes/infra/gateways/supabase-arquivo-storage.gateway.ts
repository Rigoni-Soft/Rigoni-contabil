import type { SupabaseClient } from "@supabase/supabase-js";

import type { ArquivoStoragePort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

class ArmazenamentoError extends AppError {
  readonly code = "ARMAZENAMENTO_ERROR";
}

export class SupabaseArquivoStorageGateway implements ArquivoStoragePort {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly bucket = "documentos-clientes",
  ) {}

  async enviar(caminho: string, arquivo: File): Promise<Result<{ caminho: string }, AppError>> {
    const { error } = await this.supabase.storage.from(this.bucket).upload(caminho, arquivo);

    if (error) return err(new ArmazenamentoError(`Falha ao enviar arquivo: ${error.message}`));
    return ok({ caminho });
  }

  async remover(caminhos: string[]): Promise<Result<void, AppError>> {
    if (caminhos.length === 0) return ok(undefined);
    const { data, error } = await this.supabase.storage.from(this.bucket).remove(caminhos);
    // Sem policy de DELETE o Storage não erra: devolve lista vazia. Conferir a
    // contagem evita tratar "nada removido" como sucesso.
    if (error || data?.length !== caminhos.length) {
      return err(
        new ArmazenamentoError(
          `Falha ao remover arquivos: ${error?.message ?? "nem todos removidos"}`,
        ),
      );
    }
    return ok(undefined);
  }
}
