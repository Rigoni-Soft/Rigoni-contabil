import * as tus from "tus-js-client";

import type { UploadDeAnexoPort } from "@/modules/atendimento/application/ports/out/upload-de-anexo.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { normalizarMime } from "@/shared/kernel/anexo";
import { err, ok, type Result } from "@/shared/kernel/result";

const BUCKET = "anexos-atendimento";
// Tamanho de cada parte: o do Storage do Supabase (a TUS dele exige 6 MB).
const PARTE_BYTES = 6 * 1024 * 1024;
const FALHA = "Não foi possível enviar o arquivo. Confira a conexão e tente de novo.";

function nomeSeguro(nome: string): string {
  return nome.replace(/[^\w.-]+/g, "_").slice(-120) || "arquivo";
}

// Upload resumível (TUS) do Supabase Storage, do navegador. O token é o do usuário logado: sem
// policy de INSERT que o autorize (migration 20261014130000_mensagens_anexos_e_entrega.sql), o Storage recusa. Cada parte falha e
// repete sozinha (o tus-js-client retoma de onde parou) antes de devolver erro.
export class TusUploadDeAnexoGateway implements UploadDeAnexoPort {
  constructor(
    private readonly supabaseUrl: string,
    private readonly tokenDoUsuario: () => Promise<string | null>,
  ) {}

  async enviar({
    atendimentoId,
    nome,
    tipoMime,
    conteudo,
  }: {
    atendimentoId: string;
    nome: string;
    tipoMime: string;
    conteudo: Blob;
  }): Promise<Result<string, AppError>> {
    const token = await this.tokenDoUsuario();
    if (!token) return err(new ServicoExternoError("Sua sessão expirou. Entre de novo."));
    // Uma pasta por envio (como no envio pelo servidor): o link com `download` entrega o nome original.
    const caminho = `${atendimentoId}/${crypto.randomUUID()}/${nomeSeguro(nome)}`;
    return new Promise((resolve) => {
      new tus.Upload(conteudo, {
        endpoint: `${this.supabaseUrl}/storage/v1/upload/resumable`,
        headers: { authorization: `Bearer ${token}`, "x-upsert": "false" },
        uploadDataDuringCreation: true,
        chunkSize: PARTE_BYTES,
        retryDelays: [0, 1000, 3000, 5000],
        metadata: {
          bucketName: BUCKET,
          objectName: caminho,
          // Só o tipo, sem parâmetros: o bucket confere contra a lista fechada.
          contentType: normalizarMime(tipoMime),
          cacheControl: "3600",
        },
        onError: () => resolve(err(new ServicoExternoError(FALHA))),
        onSuccess: () => resolve(ok(caminho)),
      }).start();
    });
  }
}
