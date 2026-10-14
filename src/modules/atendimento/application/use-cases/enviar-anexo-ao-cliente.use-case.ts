import type { EnviarAnexoAoClientePort } from "@/modules/atendimento/application/ports/in/enviar-anexo-ao-cliente.provider";
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
import { podeTransferir } from "@/modules/atendimento/domain/services/transferencia.service";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import {
  ANEXO_LEGENDA_TAMANHO_MAXIMO,
  miniaturaValida,
  validarAnexo,
  type TipoAnexo,
} from "@/shared/kernel/anexo";
import { err, ok, type Result } from "@/shared/kernel/result";
import { contarCaracteres } from "@/shared/kernel/texto";

const ACAO = "atendimento.enviar_anexo";

function recusa(campo: "arquivo" | "legenda", mensagem: string) {
  return err(new ValidationError(mensagem, { [campo]: [mensagem] }));
}

// Mesma regra de quem pode agir que a Transferência. Tipo e tamanho são conferidos aqui, no servidor
// (o formulário só antecipa o erro). O arquivo só vira Mensagem depois de entregue ao cliente; se a
// entrega falha, o arquivo guardado é removido.
export class EnviarAnexoAoCliente implements EnviarAnexoAoClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly anexos: AnexosAtendimentoPort,
    private readonly envio: EnvioMensagemPort,
    private readonly auditoria: AuditoriaPort,
  ) {}

  async execute({
    atendimentoId,
    arquivo,
    miniatura,
    legenda,
  }: {
    atendimentoId: string;
    arquivo: ArquivoAnexo;
    miniatura?: ArquivoAnexo;
    legenda?: string;
  }): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para enviar o arquivo."));

    const { tipo, erro } = validarAnexo(arquivo.tipoMime, arquivo.conteudo.byteLength);
    const texto = legenda?.trim() ?? "";
    if (!tipo) return recusa("arquivo", erro);
    if (contarCaracteres(texto) > ANEXO_LEGENDA_TAMANHO_MAXIMO) {
      return recusa("legenda", `A legenda aceita até ${ANEXO_LEGENDA_TAMANHO_MAXIMO} caracteres.`);
    }

    const encontrado = await this.repositorio.buscarEmAndamento(atendimentoId);
    if (!encontrado.ok) return encontrado;
    const atendimento = encontrado.value;
    if (!atendimento) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeTransferir(ator, atendimento)) {
      return err(new ForbiddenError("Você não pode enviar arquivos neste Atendimento."));
    }

    const guardado = await this.anexos.guardar({ atendimentoId, arquivo });
    if (!guardado.ok) {
      await this.auditar(ator, atendimentoId, "falha");
      return guardado;
    }
    const caminho = guardado.value;
    const miniaturaCaminho = await this.guardarMiniatura(atendimentoId, tipo, miniatura);
    const arquivos = miniaturaCaminho ? [caminho, miniaturaCaminho] : [caminho];

    const entregue = await this.entregar(atendimento.telefone, caminho, tipo, arquivo, texto);
    if (!entregue.ok) {
      await Promise.all(arquivos.map((c) => this.anexos.remover(c)));
      await this.auditar(ator, atendimentoId, "falha");
      return entregue;
    }

    const registrada = await this.repositorio.registrarMensagemDoFuncionario(
      atendimentoId,
      ator.id,
      texto,
      {
        tipo,
        nome: arquivo.nome,
        tamanho: arquivo.conteudo.byteLength,
        caminho,
        miniaturaCaminho,
      },
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

  // Só para imagem, e no formato e tamanho esperados; qualquer outra coisa (ou falha ao guardar) é
  // ignorada: a conversa mostra o original, o envio não é prejudicado.
  private async guardarMiniatura(
    atendimentoId: string,
    tipo: TipoAnexo,
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
    tipo: TipoAnexo,
    arquivo: ArquivoAnexo,
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
        nomeArquivo: arquivo.nome,
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
