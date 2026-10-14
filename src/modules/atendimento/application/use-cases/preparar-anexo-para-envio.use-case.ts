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

// O que a entrada é depois de conferida, antes de qualquer I/O (a confirmação de quem pode agir vem
// entre as duas etapas, no caso de uso).
export type AnexoConferido =
  | { origem: "memoria"; arquivo: ArquivoAnexo; tipo: TipoAnexoMensagem; formato?: FormatoAudio }
  | { origem: "storage"; guardado: { caminho: string; nome: string }; legenda?: string };

// O que vai ser entregue e registrado: o objeto já no Storage.
export type AnexoPreparado = {
  tipo: TipoAnexoMensagem;
  caminho: string;
  nome: string;
  tamanho: number;
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

// Só o ogg depende do codec (a Meta aceita Opus, e o MIME não diz qual é); mp4 passa.
function oggSemOpus(tipoMime: string, inicio: Uint8Array): boolean {
  return normalizarMime(tipoMime) === AUDIO_MIME_OGG && !ehOggOpus(inicio);
}

function legendaRecusada(legenda: string | undefined, tipo: TipoAnexoMensagem) {
  if (tipo === "audio") return null;
  return contarCaracteres(legenda?.trim() ?? "") > ANEXO_LEGENDA_TAMANHO_MAXIMO
    ? recusa("legenda", `A legenda aceita até ${ANEXO_LEGENDA_TAMANHO_MAXIMO} caracteres.`)
    : null;
}

// Põe o anexo no estado em que pode ser entregue: tipo e tamanho conferidos, áudio no formato que o
// provedor aceita (ogg/opus ou mp4; webm é convertido) e o objeto no Storage. Duas origens: os bytes
// vêm no pedido, ou o navegador já subiu o objeto em partes (docs/adr/0007) e aqui ele é conferido de
// novo pelo que o Storage tem.
export class PrepararAnexoParaEnvio {
  constructor(
    private readonly anexos: AnexosAtendimentoPort,
    private readonly conversor: ConversorDeAudioPort,
  ) {}

  // Sem I/O: o que dá para recusar antes de tocar o banco.
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

  // Confere a pasta, o tipo, o tamanho e o codec que o Storage tem e, se for webm, converte e troca
  // pelo ogg. Objeto recusado sai do Storage: não serve a ninguém.
  private async doStorage(
    atendimentoId: string,
    { caminho, nome }: { caminho: string; nome: string },
    legenda: string | undefined,
  ): Promise<Result<AnexoPreparado, AppError>> {
    if (!caminho.startsWith(`${atendimentoId}/`)) {
      return err(new ForbiddenError("Você não pode enviar arquivos neste Atendimento."));
    }
    const objeto = await this.anexos.inspecionar(caminho);
    if (!objeto.ok) return objeto;
    if (!objeto.value) return recusa("arquivo", "O arquivo não chegou inteiro. Envie de novo.");
    const { tipoMime, tamanho } = objeto.value;

    const v = validar(tipoMime, tamanho);
    if (!v.ok) return this.descartar(caminho, v);
    const { tipo, formato } = v.value;
    const recusada = legendaRecusada(legenda, tipo);
    if (recusada) return this.descartar(caminho, recusada);
    if (formato === "nativo" && normalizarMime(tipoMime) === AUDIO_MIME_OGG) {
      const inicio = await this.anexos.cabecalho(caminho, AUDIO_CABECALHO_BYTES);
      if (!inicio.ok) return inicio;
      if (oggSemOpus(tipoMime, inicio.value)) {
        return this.descartar(caminho, recusa("arquivo", AUDIO_OGG_SEM_OPUS_RECUSADO));
      }
    }
    if (formato !== "converter") return ok({ tipo, caminho, nome, tamanho });

    const bytes = await this.anexos.baixar(caminho);
    const convertido = bytes.ok
      ? await this.formatar({ nome, tipoMime, conteudo: bytes.value }, formato)
      : bytes;
    // O original (webm) sai de qualquer jeito; o navegador ainda tem a gravação para tentar de novo.
    await this.anexos.remover(caminho);
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

  // Recusado pelo que o Storage tem: o objeto não serve a ninguém e sai.
  private async descartar(caminho: string, erro: Result<never, AppError>) {
    await this.anexos.remover(caminho);
    return erro;
  }

  // Áudio aceito como está só perde os parâmetros do MIME ("audio/ogg;codecs=opus" vira
  // "audio/ogg"); webm passa pelo conversor.
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
