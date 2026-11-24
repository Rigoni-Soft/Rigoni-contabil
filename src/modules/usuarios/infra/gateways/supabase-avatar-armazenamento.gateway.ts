import type { SupabaseClient } from "@supabase/supabase-js";

import type { AvatarArmazenamentoPort } from "@/modules/usuarios/application/ports/out/avatar-armazenamento.provider";
import type { UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import type { AppError } from "@/shared/errors/app.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const BUCKET = "avatares";

export class SupabaseAvatarArmazenamentoGateway implements AvatarArmazenamentoPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async gravar(usuarioId: UsuarioId, bytes: Uint8Array): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.storage
      .from(BUCKET)
      .upload(usuarioId, bytes, { contentType: "image/webp", upsert: true });
    if (error) return err(new PersistenciaError(`Falha ao gravar a foto: ${error.message}`));
    return ok(undefined);
  }

  async apagar(usuarioId: UsuarioId): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.storage.from(BUCKET).remove([usuarioId]);
    if (error) return err(new PersistenciaError(`Falha ao apagar a foto: ${error.message}`));
    return ok(undefined);
  }

  async ler(usuarioId: UsuarioId): Promise<Result<Uint8Array | null, AppError>> {
    const { data, error } = await this.supabaseAdmin.storage.from(BUCKET).download(usuarioId);
    if (error) {
      if (ehObjetoAusente(error)) return ok(null);
      return err(new PersistenciaError(`Falha ao ler a foto: ${error.message}`));
    }
    return ok(new Uint8Array(await data.arrayBuffer()));
  }
}

function ehObjetoAusente(error: {
  message: string;
  status?: number;
  statusCode?: string;
}): boolean {
  const status = Number(error.status ?? error.statusCode);
  return status === 404 || /not.found/i.test(error.message);
}
