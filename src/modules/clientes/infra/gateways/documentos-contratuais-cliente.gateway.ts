import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  DocumentoContratualClienteDto,
  DocumentosContratuaisClientePort,
} from "@/modules/clientes/application/ports/out/documentos-contratuais-cliente.provider";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const BUCKET = "documentos-clientes";

// Row da RPC: falha alto se o banco divergir (arquitetura.md §3.9).
const rowSchema = z.array(
  z.object({
    tipo: z.enum(["contrato", "alteracao"]),
    numero: z.number().int().nullable(),
    data: z.string().nullable(),
    caminho: z.string().min(1),
  }),
);

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
    const linhas = rowSchema.safeParse(data);
    if (!linhas.success) {
      return err(new DocumentosContratuaisError("Resposta inesperada ao consultar os documentos."));
    }
    return ok(linhas.data);
  }

  async linkTemporario(
    caminho: string,
    validadeSegundos: number,
  ): Promise<Result<string, AppError>> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET)
      .createSignedUrl(caminho, validadeSegundos);
    if (error || !data) {
      return err(
        new DocumentosContratuaisError(
          "Não foi possível gerar o link do documento. Tente novamente.",
        ),
      );
    }
    return ok(data.signedUrl);
  }
}
