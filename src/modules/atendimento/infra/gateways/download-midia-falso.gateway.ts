import type {
  DownloadMidiaPort,
  MidiaBaixada,
} from "@/modules/atendimento/application/ports/out/download-midia.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { ANEXO_TAMANHO_MAXIMO } from "@/shared/kernel/anexo";
import { err, ok, type Result } from "@/shared/kernel/result";

// ~0,6 s de silêncio em ogg/opus (o formato da mensagem de voz do WhatsApp), tocável no navegador.
const OGG_OPUS_BASE64 =
  "T2dnUwACAAAAAAAAAAAXuhUhAAAAAFlxWgQBE09wdXNIZWFkAQE4AYA+AAAAAABPZ2dTAAAAAAAAAAAAABe6FSEBAAAACFp2kQE+T3B1c1RhZ3MNAAAATGF2ZjYwLjE2LjEwMAEAAAAdAAAAZW5jb2Rlcj1MYXZjNjAuMzEuMTAyIGxpYm9wdXNPZ2dTAAS4cQAAAAAAABe6FSECAAAAvMlSqh8HBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGCAvkuaC8hAgHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxggHxrMOxg==";
// PNG de 1×1 pixel.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const doBase64 = (base64: string) => new Uint8Array(Buffer.from(base64, "base64"));

// Mídias de teste do adapter falso, escolhidas pelo id que a notificação traz. O real vive na #68.
const CATALOGO: Record<string, () => MidiaBaixada> = {
  "midia-teste-audio": () => ({ bytes: doBase64(OGG_OPUS_BASE64), mime: "audio/ogg; codecs=opus" }),
  "midia-teste-imagem": () => ({ bytes: doBase64(PNG_BASE64), mime: "image/png" }),
  "midia-teste-documento": () => ({
    bytes: Buffer.from("%PDF-1.4\n%%EOF\n"),
    mime: "application/pdf",
    nome: "documento-de-teste.pdf",
  }),
  "midia-teste-grande": () => ({
    bytes: new Uint8Array(ANEXO_TAMANHO_MAXIMO + 1),
    mime: "application/pdf",
    nome: "grande.pdf",
  }),
  "midia-teste-svg": () => ({
    bytes: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
    mime: "image/svg+xml",
  }),
};

// Adapter falso (padrão em dev/e2e): não fala com o provedor. Reproduz os dois erros que a Cloud API
// dá ao baixar: mídia expirada/inexistente (permanente) e indisponibilidade (transitória).
export class DownloadMidiaFalsoGateway implements DownloadMidiaPort {
  async baixar(idDaMidia: string): Promise<Result<MidiaBaixada, AppError>> {
    if (idDaMidia === "midia-teste-fora-do-ar") {
      return err(new ServicoExternoError("Provedor de mídia indisponível."));
    }
    const midia = CATALOGO[idDaMidia]?.();
    if (!midia) return err(new ValidationError("Mídia não encontrada ou expirada."));
    return ok(midia);
  }
}
