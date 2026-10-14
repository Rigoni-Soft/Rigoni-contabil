import type {
  MidiaRecebida,
  ReceberMidiaPort,
} from "@/modules/atendimento/application/ports/in/receber-midia.provider";
import type { AnexosAtendimentoPort } from "@/modules/atendimento/application/ports/out/anexos-atendimento.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { DownloadMidiaPort } from "@/modules/atendimento/application/ports/out/download-midia.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import { soDigitosNacionais } from "@/modules/atendimento/domain/services/telefone.service";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import {
  normalizarMime,
  validarMidiaRecebida,
  type TipoAnexoMensagem,
} from "@/shared/kernel/anexo";
import { err, ok, type Result } from "@/shared/kernel/result";

const SO_TEXTO =
  "No momento só entendemos mensagens de texto. Para ser atendido, digite *menu* e escolha uma opção.";
const NAO_RECEBIDO = "O cliente enviou um arquivo que não pôde ser recebido.";

const EXTENSAO_DO_MIME: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function nomeDoArquivo(tipo: TipoAnexoMensagem, mime: string, nome: string | undefined): string {
  if (nome?.trim()) return nome.trim();
  const base = tipo === "documento" ? "arquivo" : tipo;
  const extensao = EXTENSAO_DO_MIME[mime];
  return extensao ? `${base}.${extensao}` : base;
}

// Mídia do cliente (áudio, imagem, arquivo). Só entra num Atendimento em andamento; sem ele nada é
// baixado e a URA pede texto. O que o provedor não entrega mais, ou que passa do limite/tipo, vira
// um aviso do sistema na conversa em vez de sumir; falha transitória devolve erro para o provedor
// reenviar. Idempotente pelo id da mensagem no provedor.
export class ReceberMidia implements ReceberMidiaPort {
  constructor(
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly download: DownloadMidiaPort,
    private readonly anexos: AnexosAtendimentoPort,
    private readonly envio: EnvioMensagemPort,
  ) {}

  async execute({
    telefone,
    idDaMensagem,
    midia,
    legenda,
  }: MidiaRecebida): Promise<Result<void, AppError>> {
    const chave = soDigitosNacionais(telefone);
    if (!chave) return err(new ValidationError("Telefone da mensagem é obrigatório"));

    const alvo = await this.repositorio.atendimentoParaMidia(chave, idDaMensagem);
    if (!alvo.ok) return alvo;
    if (!alvo.value) return this.envio.enviar({ telefone, texto: SO_TEXTO });
    const { atendimentoId, jaRegistrada } = alvo.value;
    if (jaRegistrada) return ok(undefined);

    const baixada = await this.download.baixar(midia.id);
    if (!baixada.ok) {
      if (baixada.error instanceof ServicoExternoError) return baixada;
      return this.avisarNaoRecebido(atendimentoId, idDaMensagem);
    }

    const { bytes, mime: mimeCru, nome } = baixada.value;
    const mime = normalizarMime(mimeCru || midia.mime);
    const validada = validarMidiaRecebida(mime, bytes.byteLength);
    if (validada.erro !== undefined) return this.avisarNaoRecebido(atendimentoId, idDaMensagem);
    const tipo = validada.tipo;
    const nomeFinal = nomeDoArquivo(tipo, mime, nome ?? midia.nome);

    const guardado = await this.anexos.guardar({
      atendimentoId,
      arquivo: { nome: nomeFinal, tipoMime: mime, conteudo: bytes },
    });
    if (!guardado.ok) return guardado;
    const caminho = guardado.value;

    const registrada = await this.repositorio.registrarMensagemRecebida(atendimentoId, {
      autor: "contato",
      texto: legenda?.trim() ?? "",
      idExterno: idDaMensagem,
      anexo: { tipo, nome: nomeFinal, tamanho: bytes.byteLength, caminho, miniaturaCaminho: null },
    });
    // Falhou ou já havia a Mensagem (reentrega em paralelo): o arquivo guardado não serve a ninguém.
    if (!registrada.ok || !registrada.value) await this.anexos.remover(caminho);
    return registrada.ok ? ok(undefined) : registrada;
  }

  private async avisarNaoRecebido(
    atendimentoId: string,
    idExterno: string | undefined,
  ): Promise<Result<void, AppError>> {
    const registrada = await this.repositorio.registrarMensagemRecebida(atendimentoId, {
      autor: "ura",
      texto: NAO_RECEBIDO,
      idExterno,
    });
    return registrada.ok ? ok(undefined) : registrada;
  }
}
