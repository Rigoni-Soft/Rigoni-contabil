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

// Word e Excel mínimos e válidos (um parágrafo; uma planilha "Balancete" com duas linhas).
const DOCX_BASE64 =
  "UEsDBBQAAAAIAANaTl15bjPX6AAAAK0BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH1QyU7DMBD9FWuuKHHggBCK0wPLETiUDxjZk8SqN3nc0v49Tlt6QIXjzFv1+tXeO7GjzDYGBbdtB4KCjsaGScHn+rV5AMEFg0EXAyk4EMNq6NeHRCyqNrCCuZT0KCXrmTxyGxOFiowxeyz1zJNMqDc4kbzrunupYygUSlMWDxj6Zxpx64p42df3qUcmxyCeTsQlSwGm5KzGUnG5C+ZXSnNOaKvyyOHZJr6pBJBXExbk74Cz7r0Ok60h8YG5vKGvLPkVs5Em6q2vyvZ/mys94zhaTRf94pZy1MRcF/euvSAebfjpL49zD99QSwMEFAAAAAgAA1pOXZv9N+qtAAAAKQEAAAsAAABfcmVscy8ucmVsc43POw7CMAwG4KtE3mlaBoRQ0y4IqSsqB7ASN61oHkrCo7cnAwNFDIy2f3+W6/ZpZnanECdnBVRFCYysdGqyWsClP232wGJCq3B2lgQsFKFt6jPNmPJKHCcfWTZsFDCm5A+cRzmSwVg4TzZPBhcMplwGzT3KK2ri27Lc8fBpwNpknRIQOlUB6xdP/9huGCZJRydvhmz6ceIrkWUMmpKAhwuKq3e7yCzwpuarF5sXUEsDBBQAAAAIAANaTl0rPyu7xgAAACABAAARAAAAd29yZC9kb2N1bWVudC54bWxtj8FqwzAMhl/F+N463WGMkKSHwp5gewAvVluDLRnJSdbHGTv0QfJiswujh/byCSHp41e3/45BzcDiCXu92zZaAY7kPJ56/fnxvnnTSrJFZwMh9PoCovdDt7SOxikCZlUEKO3S63POqTVGxjNEK1tKgGV2JI42l5ZPZiF2iWkEkeKPwbw0zauJ1qOuyi9yl1pTBVfk4UCY2WZSDlRiKFHW6/p7awV49uuVpDN1s5JvTA+SsP5MMgVbFD6CZ/vkxPwHMPfnhj9QSwECFAAUAAAACAADWk5deW4z1+gAAACtAQAAEwAAAAAAAAAAAAAAgAEAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUABQAAAAIAANaTl2b/TfqrQAAACkBAAALAAAAAAAAAAAAAACAARkBAABfcmVscy8ucmVsc1BLAQIUABQAAAAIAANaTl0rPyu7xgAAACABAAARAAAAAAAAAAAAAACAAe8BAAB3b3JkL2RvY3VtZW50LnhtbFBLBQYAAAAAAwADALkAAADkAgAAAAA=";
const XLSX_BASE64 =
  "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";

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
  "midia-teste-docx": () => ({
    bytes: doBase64(DOCX_BASE64),
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    nome: "contrato.docx",
  }),
  "midia-teste-xlsx": () => ({
    bytes: doBase64(XLSX_BASE64),
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    nome: "balancete.xlsx",
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
