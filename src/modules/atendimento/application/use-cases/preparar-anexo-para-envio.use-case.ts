import type { EntradaEnviarAnexo } from "@/modules/atendimento/application/ports/in/enviar-anexo-ao-cliente.provider";
import type {
  AnexosAtendimentoPort,
  ArquivoAnexo,
} from "@/modules/atendimento/application/ports/out/anexos-atendimento.provider";
import type { ConversorDeAudioPort } from "@/modules/atendimento/application/ports/out/conversor-de-audio.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import {
  ANEXO_LEGENDA_TAMANHO_MAXIMO,
  AUDIO_CABECALHO_BYTES,
  AUDIO_MIME_OGG,
  AUDIO_OGG_SEM_OPUS_RECUSADO,
  ehAudio,
  ehOggOpus,
  normalizarMime,
  validarAnexo,
  validarAudio,
  type TipoAnexoMensagem,
} from "@/shared/kernel/anexo";
import { err, ok, type Result } from "@/shared/kernel/result";
import { contarCaracteres } from "@/shared/kernel/texto";

export function recusa(campo: "arquivo" | "legenda", mensagem: string) {
  return err(new ValidationError(mensagem, { [campo]: [mensagem] }));
}

type FormatoAudio = "nativo" | "converter";

export type AnexoConferido =
  | { origem: "memoria"; arquivo: ArquivoAnexo; tipo: TipoAnexoMensagem; formato?: FormatoAudio }
  | { origem: "storage"; guardado: { caminho: string; nome: string }; legenda?: string };

export type AnexoPreparado = {
  tipo: TipoAnexoMensagem;
  caminho: string;
  nome: string;
  tamanho: number;
  reserva?: string;
};

function validar(
  tipoMime: string,
  bytes: number,
): Result<{ tipo: TipoAnexoMensagem; formato?: FormatoAudio }, AppError> {
  if (ehAudio(tipoMime)) {
    const v = validarAudio(tipoMime, bytes);
    return v.erro !== undefined
      ? recusa("arquivo", v.erro)
      : ok({ tipo: "audio", formato: v.formato });
  }
  const v = validarAnexo(tipoMime, bytes);
  return v.erro !== undefined ? recusa("arquivo", v.erro) : ok({ tipo: v.tipo });
}

function oggSemOpus(tipoMime: string, inicio: Uint8Array): boolean {
  return normalizarMime(tipoMime) === AUDIO_MIME_OGG && !ehOggOpus(inicio);
}

function legendaRecusada(legenda: string | undefined, tipo: TipoAnexoMensagem) {
  if (tipo === "audio") return null;
  return contarCaracteres(legenda?.trim() ?? "") > ANEXO_LEGENDA_TAMANHO_MAXIMO
    ? recusa("legenda", `A legenda aceita até ${ANEXO_LEGENDA_TAMANHO_MAXIMO} caracteres.`)
    : null;
}

export class PrepararAnexoParaEnvio {
  constructor(
    private readonly anexos: AnexosAtendimentoPort,
    private readonly conversor: ConversorDeAudioPort,
  ) {}

  conferir(entrada: EntradaEnviarAnexo): Result<AnexoConferido, AppError> {
    if ("guardado" in entrada) {
      return ok({ origem: "storage", guardado: entrada.guardado, legenda: entrada.legenda });
    }
    const { arquivo } = entrada;
    const v = validar(arquivo.tipoMime, arquivo.conteudo.byteLength);
    if (!v.ok) return v;
    const recusada = legendaRecusada(entrada.legenda, v.value.tipo);
    if (recusada) return recusada;
    if (oggSemOpus(arquivo.tipoMime, arquivo.conteudo)) {
      return recusa("arquivo", AUDIO_OGG_SEM_OPUS_RECUSADO);
    }
    return ok({ origem: "memoria", arquivo, ...v.value });
  }

  async preparar(
    atendimentoId: string,
    conferido: AnexoConferido,
  ): Promise<Result<AnexoPreparado, AppError>> {
    return conferido.origem === "memoria"
      ? this.deMemoria(atendimentoId, conferido)
      : this.doStorage(atendimentoId, conferido.guardado, conferido.legenda);
  }

  private async deMemoria(
    atendimentoId: string,
    { arquivo, tipo, formato }: Extract<AnexoConferido, { origem: "memoria" }>,
  ): Promise<Result<AnexoPreparado, AppError>> {
    const pronto = await this.formatar(arquivo, formato);
    if (!pronto.ok) return pronto;
    const guardado = await this.anexos.guardar({ atendimentoId, arquivo: pronto.value });
    if (!guardado.ok) return guardado;
    return ok({
      tipo,
      caminho: guardado.value,
      nome: pronto.value.nome,
      tamanho: pronto.value.conteudo.byteLength,
    });
  }

  private async doStorage(
    atendimentoId: string,
    { caminho, nome }: { caminho: string; nome: string },
    legenda: string | undefined,
  ): Promise<Result<AnexoPreparado, AppError>> {
    if (!caminho.startsWith(`${atendimentoId}/`)) {
      return err(new ForbiddenError("Você não pode enviar arquivos neste Atendimento."));
    }
    const reservado = await this.anexos.reservar(caminho, atendimentoId);
    if (!reservado.ok) return reservado;
    if (!reservado.value) return recusa("arquivo", "Este arquivo já foi enviado.");

    const objeto = await this.anexos.inspecionar(caminho);
    if (!objeto.ok) return this.descartar(caminho, objeto);
    if (!objeto.value) return recusa("arquivo", "O arquivo não chegou inteiro. Envie de novo.");
    const { tipoMime, tamanho } = objeto.value;

    const v = validar(tipoMime, tamanho);
    if (!v.ok) return this.descartar(caminho, v);
    const { tipo, formato } = v.value;
    const recusada = legendaRecusada(legenda, tipo);
    if (recusada) return this.descartar(caminho, recusada);
    if (formato === "nativo" && normalizarMime(tipoMime) === AUDIO_MIME_OGG) {
      const inicio = await this.anexos.cabecalho(caminho, AUDIO_CABECALHO_BYTES);
      if (!inicio.ok) return this.descartar(caminho, inicio);
      if (oggSemOpus(tipoMime, inicio.value)) {
        return this.descartar(caminho, recusa("arquivo", AUDIO_OGG_SEM_OPUS_RECUSADO));
      }
    }
    if (formato !== "converter") return ok({ tipo, caminho, nome, tamanho, reserva: caminho });

    const bytes = await this.anexos.baixar(caminho);
    const convertido = bytes.ok
      ? await this.formatar({ nome, tipoMime, conteudo: bytes.value }, formato)
      : bytes;
    await this.anexos.remover(caminho);
    await this.anexos.liberarReserva(caminho);
    if (!convertido.ok) return convertido;
    const novo = await this.anexos.guardar({ atendimentoId, arquivo: convertido.value });
    if (!novo.ok) return novo;
    return ok({
      tipo,
      caminho: novo.value,
      nome: convertido.value.nome,
      tamanho: convertido.value.conteudo.byteLength,
    });
  }

  private async descartar(caminho: string, erro: Result<never, AppError>) {
    await this.anexos.remover(caminho);
    await this.anexos.liberarReserva(caminho);
    return erro;
  }

  private async formatar(
    arquivo: ArquivoAnexo,
    formato: FormatoAudio | undefined,
  ): Promise<Result<ArquivoAnexo, AppError>> {
    if (!formato) return ok(arquivo);
    if (formato === "nativo") {
      return ok({ ...arquivo, tipoMime: normalizarMime(arquivo.tipoMime) });
    }
    const convertido = await this.conversor.paraOggOpus(arquivo.conteudo);
    if (!convertido.ok) return convertido;
    return ok({
      nome: arquivo.nome.replace(/\.[^.]+$/, "") + ".ogg",
      tipoMime: AUDIO_MIME_OGG,
      conteudo: convertido.value,
    });
  }
}
