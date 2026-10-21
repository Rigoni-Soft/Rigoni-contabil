import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DocumentoContratualClienteDto,
  DocumentosContratuaisClientePort,
} from "@/modules/clientes/application/ports/out/documentos-contratuais-cliente.provider";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const BUCKET = "documentos-clientes";

class DocumentosContratuaisError extends AppError {
  readonly code = "DOCUMENTOS_CONTRATUAIS_ERROR";
}

// Sessão do usuário: a RPC e a policy de storage.objects aplicam pode_ver_cliente + Setor SN.
export class SupabaseDocumentosContratuaisClienteGateway implements DocumentosContratuaisClientePort {
  constructor(private readonly supabase: SupabaseClient) {}

  async listar(clienteId: string): Promise<Result<DocumentoContratualClienteDto[], AppError>> {
    const { data, error } = await this.supabase.rpc("documentos_contratuais_do_cliente", {
      p_cliente_id: clienteId,
    });
    if (error) {
      return err(new DocumentosContratuaisError("Falha ao consultar os documentos do Cliente."));
    }
    return ok(data as DocumentoContratualClienteDto[]);
  }

  async linkTemporario(
    caminho: string,
    validadeSegundos: number,
  ): Promise<Result<string, AppError>> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET)
      .createSignedUrl(caminho, validadeSegundos);
    if (error || !data) {
      return err(new DocumentosContratuaisError("Falha ao gerar o link do documento."));
    }
    return ok(data.signedUrl);
  }
}
