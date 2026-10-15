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
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/atendimento/application/ports/out/sessao.provider";
import type { PrepararAnexoParaEnvio } from "@/modules/atendimento/application/use-cases/preparar-anexo-para-envio.use-case";
import { podeTransferir } from "@/modules/atendimento/domain/services/transferencia.service";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { miniaturaValida, type TipoAnexoMensagem } from "@/shared/kernel/anexo";
import { err, ok, type Result } from "@/shared/kernel/result";

const ACAO = "atendimento.enviar_anexo";

// Mesma regra de quem pode agir que a Transferência. O arquivo só vira Mensagem depois de entregue ao
// cliente; se a entrega falha, o arquivo guardado é removido. Tipo, tamanho e formato de áudio (e a
// conversão de webm) são do `PrepararAnexoParaEnvio`; aqui ficam a autorização, a entrega, o registro
// e a auditoria. Áudio não leva legenda.
export class EnviarAnexoAoCliente implements EnviarAnexoAoClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly anexos: AnexosAtendimentoPort,
    private readonly envio: EnvioMensagemPort,
    private readonly auditoria: AuditoriaPort,
    private readonly preparador: PrepararAnexoParaEnvio,
  ) {}

  async execute(entrada: EntradaEnviarAnexo): Promise<Result<void, AppError>> {
    const { atendimentoId, legenda } = entrada;
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para enviar o arquivo."));

    const conferido = this.preparador.conferir(entrada);
    if (!conferido.ok) return conferido;

    const encontrado = await this.repositorio.buscarEmAndamento(atendimentoId);
    if (!encontrado.ok) return encontrado;
    const atendimento = encontrado.value;
    if (!atendimento) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeTransferir(ator, atendimento)) {
      return err(new ForbiddenError("Você não pode enviar arquivos neste Atendimento."));
    }

    const preparado = await this.preparador.preparar(atendimentoId, conferido.value);
    if (!preparado.ok) {
      await this.auditar(ator, atendimentoId, "falha");
      return preparado;
    }
    const { tipo, caminho, nome, tamanho, reserva } = preparado.value;
    const texto = tipo === "audio" ? "" : (legenda?.trim() ?? "");

    const miniaturaCaminho = await this.guardarMiniatura(atendimentoId, tipo, entrada.miniatura);
    const arquivos = miniaturaCaminho ? [caminho, miniaturaCaminho] : [caminho];

    // Registro antes da entrega, sob o lock do Atendimento (ver EnviarMensagemAoCliente): se o
    // fechamento venceu, o arquivo guardado sai e nada é enviado.
    const registrada = await this.repositorio.registrarMensagemDoFuncionario(
      atendimentoId,
      ator,
      texto,
      { tipo, nome, tamanho, caminho, miniaturaCaminho },
    );
    if (!registrada.ok || registrada.value.status !== "registrada") {
      await this.descartarArquivos(arquivos, reserva);
      await this.auditar(ator, atendimentoId, "falha");
      return this.recusaDoRegistro(registrada);
    }

    const entregue = await this.entregar(atendimento.telefone, caminho, tipo, nome, texto);
    if (!entregue.ok) {
      await this.auditar(ator, atendimentoId, "falha");
      const desfeita = await this.repositorio.desfazerMensagemDoFuncionario(registrada.value.id);
      await this.descartarArquivos(arquivos, reserva);
      if (desfeita.ok) return entregue;
      return err(
        new EstadoInconsistenteError(
          "O arquivo não foi enviado, mas a conversa o registra.",
          atendimentoId,
        ),
      );
    }
    await this.auditar(ator, atendimentoId, "sucesso");
    return ok(undefined);
  }

  // Só o que esta tentativa guardou ou reservou: a reserva sai junto do objeto.
  private async descartarArquivos(arquivos: string[], reserva: string | undefined) {
    await Promise.all(arquivos.map((c) => this.anexos.remover(c)));
    if (reserva) await this.anexos.liberarReserva(reserva);
  }

  private recusaDoRegistro(
    registrada: Awaited<ReturnType<AtendimentoRepositoryPort["registrarMensagemDoFuncionario"]>>,
  ): Result<void, AppError> {
    if (!registrada.ok) return registrada;
    if (registrada.value.status === "encerrada") {
      return err(new NotFoundError("O Atendimento já foi encerrado."));
    }
    return err(new ForbiddenError("Você não pode enviar arquivos neste Atendimento."));
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
