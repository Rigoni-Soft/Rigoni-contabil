import type {
  DownloadMidiaPort,
  MidiaBaixada,
} from "@/modules/atendimento/application/ports/out/download-midia.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const VERSAO_API = "v21.0";
const TIMEOUT_MS = 15_000;

// Adapter real da porta DownloadMidiaPort, pela WhatsApp Cloud API: GET /{id} devolve o
// endereço temporário e o mime; o arquivo sai de lá com o mesmo bearer. 404 (mídia expirada) e 400
// (id inválido) não melhoram ao repetir: ValidationError. O resto (401/403, 429, 5xx, rede) é
// falha do serviço: ServicoExternoError, e a Meta reenvia o evento.
export class DownloadMidiaWhatsappGateway implements DownloadMidiaPort {
  constructor(
    private readonly token: string,
    private readonly http: typeof fetch = fetch,
  ) {}

  async baixar(idDaMidia: string): Promise<Result<MidiaBaixada, AppError>> {
    try {
      const meta = await this.buscar(
        `https://graph.facebook.com/${VERSAO_API}/${encodeURIComponent(idDaMidia)}`,
      );
      if (!meta.ok) return meta;
      const { url, mime_type: mime } = (await meta.value.json().catch(() => null)) as {
        url?: unknown;
        mime_type?: unknown;
      };
      if (typeof url !== "string" || typeof mime !== "string") {
        return err(new ServicoExternoError("Serviço de mensageria não devolveu a mídia."));
      }
      const arquivo = await this.buscar(url);
      if (!arquivo.ok) return arquivo;
      return ok({ bytes: new Uint8Array(await arquivo.value.arrayBuffer()), mime });
    } catch {
      return err(new ServicoExternoError("Serviço de mensageria indisponível."));
    }
  }

  private async buscar(url: string): Promise<Result<Response, AppError>> {
    const resposta = await this.http(url, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (resposta.ok) return ok(resposta);
    const texto = `Download recusado (${resposta.status}).`;
    return err(
      resposta.status === 400 || resposta.status === 404
        ? new ValidationError(texto)
        : new ServicoExternoError(texto),
    );
  }
}
