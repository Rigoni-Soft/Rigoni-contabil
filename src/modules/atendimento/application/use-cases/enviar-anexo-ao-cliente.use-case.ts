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
  ANEXO_TAMANHO_MAXIMO,
  ANEXO_TIPO_RECUSADO,
  classificarAnexo,
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
    legenda,
  }: {
    atendimentoId: string;
    arquivo: ArquivoAnexo;
    legenda?: string;
  }): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para enviar o arquivo."));

    const tipo = classificarAnexo(arquivo.tipoMime);
    const texto = legenda?.trim() ?? "";
    if (!tipo) {
      return recusa("arquivo", ANEXO_TIPO_RECUSADO);
    }
    if (arquivo.conteudo.byteLength === 0) return recusa("arquivo", "O arquivo está vazio.");
    if (arquivo.conteudo.byteLength > ANEXO_TAMANHO_MAXIMO) {
      return recusa("arquivo", "O arquivo aceita até 10 MB.");
    }
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

    const entregue = await this.entregar(atendimento.telefone, caminho, tipo, arquivo, texto);
    if (!entregue.ok) {
      await this.anexos.remover(caminho);
      await this.auditar(ator, atendimentoId, "falha");
      return entregue;
    }

    const registrada = await this.repositorio.registrarMensagemDoFuncionario(
      atendimentoId,
      ator.id,
      texto,
      { tipo, nome: arquivo.nome, tamanho: arquivo.conteudo.byteLength, caminho },
    );
    // Já entregue: o registro falhar não desfaz o envio, e o arquivo fica (o cliente o recebeu).
    await this.auditar(ator, atendimentoId, "sucesso");
    if (!registrada.ok) {
      return err(
        new EstadoInconsistenteError(
          "Arquivo enviado, mas a conversa não o registrou.",
          atendimentoId,
        ),
      );
    }
    return ok(undefined);
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
