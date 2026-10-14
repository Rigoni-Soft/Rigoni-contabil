import type {
  EntradaEnviarAnexo,
  EnviarAnexoAoClientePort,
} from "@/modules/atendimento/application/ports/in/enviar-anexo-ao-cliente.provider";
import type {
  AnexosAtendimentoPort,
  ArquivoAnexo,
} from "@/modules/atendimento/application/ports/out/anexos-atendimento.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { ConversorDeAudioPort } from "@/modules/atendimento/application/ports/out/conversor-de-audio.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/atendimento/application/ports/out/sessao.provider";
import { podeTransferir } from "@/modules/atendimento/domain/services/transferencia.service";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import {
  ANEXO_LEGENDA_TAMANHO_MAXIMO,
  AUDIO_MIME_OGG,
  ehAudio,
  miniaturaValida,
  normalizarMime,
  validarAnexo,
  validarAudio,
  type TipoAnexoMensagem,
} from "@/shared/kernel/anexo";
import { err, ok, type Result } from "@/shared/kernel/result";
import { contarCaracteres } from "@/shared/kernel/texto";

const ACAO = "atendimento.enviar_anexo";

function recusa(campo: "arquivo" | "legenda", mensagem: string) {
  return err(new ValidationError(mensagem, { [campo]: [mensagem] }));
}

type Validado = {
  tipo: TipoAnexoMensagem;
  // Só áudio: "converter" (webm) passa pelo conversor antes de entregar.
  formatoAudio?: "nativo" | "converter";
};

function validar(tipoMime: string, bytes: number): Result<Validado, AppError> {
  if (ehAudio(tipoMime)) {
    const v = validarAudio(tipoMime, bytes);
    return v.erro !== undefined
      ? recusa("arquivo", v.erro)
      : ok({ tipo: "audio", formatoAudio: v.formato });
  }
  const v = validarAnexo(tipoMime, bytes);
  return v.erro !== undefined ? recusa("arquivo", v.erro) : ok({ tipo: v.tipo });
}

// O que vai ser entregue e registrado: o objeto já no Storage.
type Preparado = { tipo: TipoAnexoMensagem; caminho: string; nome: string; tamanho: number };

// Mesma regra de quem pode agir que a Transferência. Tipo e tamanho são conferidos aqui, no servidor
// (o formulário só antecipa o erro). O arquivo só vira Mensagem depois de entregue ao cliente; se a
// entrega falha, o arquivo guardado é removido. Duas origens: `arquivo` (os bytes vêm no pedido) ou
// `guardado` (o navegador já subiu o objeto em partes, docs/adr/0007; o objeto é conferido aqui de
// novo, pelo que o Storage tem). Áudio gravado em webm (Chrome/Edge) é convertido para ogg/opus antes
// de entregar: o provedor nunca recebe webm. Áudio não leva legenda.
export class EnviarAnexoAoCliente implements EnviarAnexoAoClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly anexos: AnexosAtendimentoPort,
    private readonly envio: EnvioMensagemPort,
    private readonly auditoria: AuditoriaPort,
    private readonly conversor: ConversorDeAudioPort,
  ) {}

  async execute(entrada: EntradaEnviarAnexo): Promise<Result<void, AppError>> {
    const { atendimentoId, legenda } = entrada;
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para enviar o arquivo."));

    // Arquivo em memória: confere antes de tocar o banco.
    const memoria = "arquivo" in entrada ? entrada.arquivo : undefined;
    let validado: Validado | undefined;
    if (memoria) {
      const v = validar(memoria.tipoMime, memoria.conteudo.byteLength);
      if (!v.ok) return v;
      validado = v.value;
      const recusada = this.conferirLegenda(legenda, validado.tipo);
      if (recusada) return recusada;
    }

    const encontrado = await this.repositorio.buscarEmAndamento(atendimentoId);
    if (!encontrado.ok) return encontrado;
    const atendimento = encontrado.value;
    if (!atendimento) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeTransferir(ator, atendimento)) {
      return err(new ForbiddenError("Você não pode enviar arquivos neste Atendimento."));
    }

    const preparado =
      memoria && validado
        ? await this.prepararDeMemoria(atendimentoId, memoria, validado)
        : "guardado" in entrada
          ? await this.prepararGuardado(atendimentoId, entrada.guardado, legenda)
          : recusa("arquivo", "Escolha o arquivo.");
    if (!preparado.ok) {
      await this.auditar(ator, atendimentoId, "falha");
      return preparado;
    }
    const { tipo, caminho, nome, tamanho } = preparado.value;
    const texto = tipo === "audio" ? "" : (legenda?.trim() ?? "");

    const miniaturaCaminho = await this.guardarMiniatura(
      atendimentoId,
      tipo,
      "arquivo" in entrada ? entrada.miniatura : undefined,
    );
    const arquivos = miniaturaCaminho ? [caminho, miniaturaCaminho] : [caminho];

    const entregue = await this.entregar(atendimento.telefone, caminho, tipo, nome, texto);
    if (!entregue.ok) {
      await Promise.all(arquivos.map((c) => this.anexos.remover(c)));
      await this.auditar(ator, atendimentoId, "falha");
      return entregue;
    }

    const registrada = await this.repositorio.registrarMensagemDoFuncionario(
      atendimentoId,
      ator.id,
      texto,
      { tipo, nome, tamanho, caminho, miniaturaCaminho },
    );
    // Já entregue: o registro falhar não desfaz o envio, e o arquivo fica (o cliente o recebeu).
    // A miniatura, que só a conversa usaria, não fica órfã.
    await this.auditar(ator, atendimentoId, "sucesso");
    if (!registrada.ok) {
      if (miniaturaCaminho) await this.anexos.remover(miniaturaCaminho);
      return err(
        new EstadoInconsistenteError(
          "Arquivo enviado, mas a conversa não o registrou.",
          atendimentoId,
        ),
      );
    }
    return ok(undefined);
  }

  private conferirLegenda(legenda: string | undefined, tipo: TipoAnexoMensagem) {
    if (tipo === "audio") return null;
    const texto = legenda?.trim() ?? "";
    return contarCaracteres(texto) > ANEXO_LEGENDA_TAMANHO_MAXIMO
      ? recusa("legenda", `A legenda aceita até ${ANEXO_LEGENDA_TAMANHO_MAXIMO} caracteres.`)
      : null;
  }

  private async prepararDeMemoria(
    atendimentoId: string,
    arquivo: ArquivoAnexo,
    { tipo, formatoAudio }: Validado,
  ): Promise<Result<Preparado, AppError>> {
    const pronto = await this.prepararArquivo(arquivo, formatoAudio);
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

  // O objeto já está no Storage (o navegador o subiu em partes): confere a pasta, o tipo e o tamanho
  // que o Storage tem e, se for webm, converte e troca pelo ogg.
  private async prepararGuardado(
    atendimentoId: string,
    { caminho, nome }: { caminho: string; nome: string },
    legenda: string | undefined,
  ): Promise<Result<Preparado, AppError>> {
    if (!caminho.startsWith(`${atendimentoId}/`)) {
      return err(new ForbiddenError("Você não pode enviar arquivos neste Atendimento."));
    }
    const objeto = await this.anexos.inspecionar(caminho);
    if (!objeto.ok) return objeto;
    if (!objeto.value) return recusa("arquivo", "O arquivo não chegou inteiro. Envie de novo.");
    const { tipoMime, tamanho } = objeto.value;

    const v = validar(tipoMime, tamanho);
    if (!v.ok) {
      await this.anexos.remover(caminho);
      return v;
    }
    const recusada = this.conferirLegenda(legenda, v.value.tipo);
    if (recusada) {
      await this.anexos.remover(caminho);
      return recusada;
    }
    const { tipo, formatoAudio } = v.value;
    if (formatoAudio !== "converter") return ok({ tipo, caminho, nome, tamanho });

    const bytes = await this.anexos.baixar(caminho);
    // O original (webm) não serve a ninguém: sai de qualquer jeito. O navegador ainda tem a gravação.
    if (!bytes.ok) {
      await this.anexos.remover(caminho);
      return bytes;
    }
    const convertido = await this.prepararArquivo(
      { nome, tipoMime, conteudo: bytes.value },
      formatoAudio,
    );
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

  // Áudio em formato que o provedor aceita só perde os parâmetros do MIME ("audio/ogg;codecs=opus"
  // vira "audio/ogg"); o que não aceita (webm) passa pelo conversor.
  private async prepararArquivo(
    arquivo: ArquivoAnexo,
    formato: "nativo" | "converter" | undefined,
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

  // Só para imagem, e no formato e tamanho esperados; qualquer outra coisa (ou falha ao guardar) é
  // ignorada: a conversa mostra o original, o envio não é prejudicado.
  private async guardarMiniatura(
    atendimentoId: string,
    tipo: TipoAnexoMensagem,
    miniatura: ArquivoAnexo | undefined,
  ): Promise<string | null> {
    if (
      tipo !== "imagem" ||
      !miniatura ||
      !miniaturaValida(miniatura.tipoMime, miniatura.conteudo.byteLength)
    ) {
      return null;
    }
    const guardada = await this.anexos.guardar({ atendimentoId, arquivo: miniatura });
    return guardada.ok ? guardada.value : null;
  }

  private async entregar(
    telefone: string,
    caminho: string,
    tipo: TipoAnexoMensagem,
    nomeArquivo: string,
    legenda: string,
  ): Promise<Result<void, AppError>> {
    const links = await this.anexos.linksTemporarios([caminho]);
    if (!links.ok) return links;
    const link = links.value[caminho];
    if (!link) return err(new ServicoExternoError("Falha ao gerar o link do arquivo."));
    try {
      return await this.envio.enviarAnexo({
        telefone,
        tipo,
        url: link.url,
        nomeArquivo,
        legenda: legenda || undefined,
      });
    } catch {
      return err(new ServicoExternoError("Falha ao enviar o arquivo."));
    }
  }

  private auditar(ator: AtorSessaoDto, atendimentoId: string, resultado: "sucesso" | "falha") {
    return this.auditoria.registrar({
      ator: ator.id,
      setor: ator.setor,
      acao: ACAO,
      alvo: atendimentoId,
      resultado,
    });
  }
}
