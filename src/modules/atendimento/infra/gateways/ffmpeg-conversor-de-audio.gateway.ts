import { spawn } from "node:child_process";

import type { ConversorDeAudioPort } from "@/modules/atendimento/application/ports/out/conversor-de-audio.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const SEM_FFMPEG =
  "Este ambiente não tem como converter o áudio. Tente de novo pelo Firefox ou Safari, ou avise o suporte; a gravação continua aqui.";
const FALHA_NA_CONVERSAO = "Não foi possível converter o áudio. Tente gravar de novo.";

// ogg/opus mono, o formato da mensagem de voz do WhatsApp. Entrada e saída por pipe: nada vai a disco.
const ARGUMENTOS = [
  ...["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-vn"],
  ...["-ac", "1", "-c:a", "libopus", "-b:a", "32k", "-f", "ogg", "pipe:1"],
];

// Usa o binário `ffmpeg` do ambiente (ou o de `caminho`); sem ele a conversão falha com mensagem
// clara e nada é perdido (docs/adr/0006).
export class FfmpegConversorDeAudioGateway implements ConversorDeAudioPort {
  constructor(
    private readonly caminho = "ffmpeg",
    private readonly timeoutMs = 30_000,
  ) {}

  paraOggOpus(conteudo: Uint8Array): Promise<Result<Uint8Array, AppError>> {
    return new Promise((resolve) => {
      const saida: Buffer[] = [];
      let encerrado = false;
      const encerrar = (resultado: Result<Uint8Array, AppError>) => {
        if (encerrado) return;
        encerrado = true;
        clearTimeout(limite);
        resolve(resultado);
      };

      const processo = spawn(this.caminho, ARGUMENTOS, { stdio: ["pipe", "pipe", "ignore"] });
      const limite = setTimeout(() => {
        processo.kill();
        encerrar(err(new ServicoExternoError(FALHA_NA_CONVERSAO)));
      }, this.timeoutMs);

      processo.on("error", (erro: NodeJS.ErrnoException) =>
        encerrar(
          err(new ServicoExternoError(erro.code === "ENOENT" ? SEM_FFMPEG : FALHA_NA_CONVERSAO)),
        ),
      );
      processo.stdout.on("data", (parte: Buffer) => saida.push(parte));
      processo.on("close", (codigo) => {
        const bytes = Buffer.concat(saida);
        encerrar(
          codigo === 0 && bytes.byteLength > 0
            ? ok(new Uint8Array(bytes))
            : err(new ServicoExternoError(FALHA_NA_CONVERSAO)),
        );
      });
      // ffmpeg que morre antes de ler tudo fecha o pipe: o erro vem pelo `close`.
      processo.stdin.on("error", () => {});
      processo.stdin.end(conteudo);
    });
  }
}
