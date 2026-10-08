import type { EnviarDocumentoAoClientePort } from "@/modules/atendimento/application/ports/in/enviar-documento-ao-cliente.provider";
import type { DocumentoDisponivel } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { DocumentosContratuaisPort } from "@/modules/atendimento/application/ports/out/documentos-contratuais.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/atendimento/application/ports/out/sessao.provider";
import { descreverDocumento } from "@/modules/atendimento/domain/services/documento-contratual.service";
import { podeTransferir } from "@/modules/atendimento/domain/services/transferencia.service";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const ACAO = "atendimento.enviar_documento";

// Funcionário dispara o mesmo serviço do menu da URA usando o Cliente já vinculado ao Atendimento
// (sem perguntar o CNPJ de novo). Mesma regra de quem pode agir que a Transferência.
export class EnviarDocumentoAoCliente implements EnviarDocumentoAoClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly documentos: DocumentosContratuaisPort,
    private readonly envio: EnvioMensagemPort,
    private readonly auditoria: AuditoriaPort,
  ) {}

  async execute({
    atendimentoId,
    documento,
  }: {
    atendimentoId: string;
    documento: DocumentoDisponivel;
  }): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para enviar o documento."));

    const encontrado = await this.repositorio.buscarEmAndamento(atendimentoId);
    if (!encontrado.ok) return encontrado;
    const atendimento = encontrado.value;
    if (!atendimento) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeTransferir(ator, atendimento)) {
      return err(new ForbiddenError("Você não pode enviar documentos neste Atendimento."));
    }
    if (!atendimento.clienteId) {
      return err(new ValidationError("O Atendimento não tem Cliente vinculado."));
    }

    const lista = await this.documentos.listar(atendimento.clienteId);
    if (!lista.ok) return lista;
    const escolhido = lista.value.find(
      (d) => d.tipo === documento.tipo && d.data === documento.data,
    );
    if (!escolhido) return err(new NotFoundError("O Cliente não tem esse documento."));

    const descricao = descreverDocumento(escolhido);
    const enviado = await this.enviar(atendimento.telefone, escolhido.caminho, descricao);
    if (!enviado.ok) {
      await this.auditar(ator, atendimentoId, "falha");
      return enviado;
    }

    // Já entregue ao cliente: falhar o registro não desfaz nada, o erro diz que a conversa não
    // mostra o envio.
    const registrada = await this.repositorio.registrarMensagemDoFuncionario(
      atendimentoId,
      ator.id,
      `Enviou ao cliente: ${descricao}`,
    );
    await this.auditar(ator, atendimentoId, "sucesso");
    if (!registrada.ok) {
      return err(
        new EstadoInconsistenteError(
          "Documento enviado, mas a conversa não registrou o envio.",
          atendimentoId,
        ),
      );
    }
    return ok(undefined);
  }

  private async enviar(
    telefone: string,
    caminho: string,
    descricao: string,
  ): Promise<Result<void, AppError>> {
    const link = await this.documentos.linkTemporario(caminho);
    if (!link.ok) return link;
    const extensao = /\.[A-Za-z0-9]+$/.exec(caminho)?.[0] ?? "";
    try {
      return await this.envio.enviarDocumento({
        telefone,
        url: link.value,
        nomeArquivo: `${descricao}${extensao}`,
      });
    } catch {
      return err(new ServicoExternoError("Falha ao enviar o documento."));
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
