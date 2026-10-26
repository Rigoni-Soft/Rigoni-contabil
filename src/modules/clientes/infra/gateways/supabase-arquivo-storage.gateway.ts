import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ArquivoComLinkPort,
  ArquivoInspecionavelPort,
} from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

class ArmazenamentoError extends AppError {
  readonly code = "ARMAZENAMENTO_ERROR";
}

export class SupabaseArquivoStorageGateway implements ArquivoInspecionavelPort, ArquivoComLinkPort {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly bucket = "documentos-clientes",
  ) {}

  async enviar(caminho: string, arquivo: File): Promise<Result<{ caminho: string }, AppError>> {
    const { error } = await this.supabase.storage.from(this.bucket).upload(caminho, arquivo);

    if (error) return err(new ArmazenamentoError(`Falha ao enviar arquivo: ${error.message}`));
    return ok({ caminho });
  }

  async inspecionar(
    caminho: string,
  ): Promise<Result<{ tipoMime: string; tamanho: number } | null, AppError>> {
    const { data, error } = await this.supabase.storage.from(this.bucket).info(caminho);
    // O Storage não distingue objeto inexistente de falha de rede: os dois viram "não está lá".
    if (error || !data) return ok(null);
    return ok({ tipoMime: data.contentType ?? "", tamanho: data.size ?? 0 });
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

  async linkTemporario(
    caminho: string,
    validadeSegundos: number,
  ): Promise<Result<string, AppError>> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(caminho, validadeSegundos);
    if (error || !data) {
      return err(new ArmazenamentoError("Não foi possível gerar o link do arquivo."));
    }
    return ok(data.signedUrl);
  }
}
