import type {
  DocumentoParaEnviar,
  EnviarDocumentoAoClientePort,
} from "@/modules/atendimento/application/ports/in/enviar-documento-ao-cliente.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { DocumentosContratuaisPort } from "@/modules/atendimento/application/ports/out/documentos-contratuais.provider";
import type {
  DocumentoEnviado,
  EnvioMensagemPort,
} from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type {
  GuiasFiscaisPort,
  TipoGuia,
} from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/atendimento/application/ports/out/sessao.provider";
import {
  descreverDocumento,
  ROTULO_GUIA,
} from "@/modules/atendimento/domain/services/documento-contratual.service";
import { podeTransferir } from "@/modules/atendimento/domain/services/transferencia.service";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const ACAO = "atendimento.enviar_documento";

// O que o Funcionário escolheu, já resolvido: como o cliente o vê e como entregá-lo.
type Preparado = {
  descricao: string;
  entregar: (telefone: string, chaveIdempotencia: string) => Promise<Result<void, AppError>>;
};

const ehGuia = (tipo: DocumentoParaEnviar["tipo"]): tipo is TipoGuia => tipo in ROTULO_GUIA;

// Funcionário dispara o mesmo serviço do menu da URA usando o Cliente já vinculado ao Atendimento
// (sem perguntar o CNPJ de novo). Mesma regra de quem pode agir que a Transferência.
export class EnviarDocumentoAoCliente implements EnviarDocumentoAoClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly documentos: DocumentosContratuaisPort,
    private readonly guias: GuiasFiscaisPort,
    private readonly envio: EnvioMensagemPort,
    private readonly auditoria: AuditoriaPort,
  ) {}

  async execute({
    atendimentoId,
    documento,
  }: {
    atendimentoId: string;
    documento: DocumentoParaEnviar;
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

    // Antes de registrar: documento ausente, guia sem autorização fiscal ou provedor fora do ar
    // devolvem o erro sem deixar Mensagem no Atendimento, mas a tentativa fica auditada.
    const preparado = await this.preparar(atendimento.clienteId, documento);
    if (!preparado.ok) {
      await this.auditar(ator, atendimentoId, "falha");
      return preparado;
    }
    const { descricao, entregar } = preparado.value;

    // Registro antes da entrega, sob o lock do Atendimento (ver EnviarMensagemAoCliente).
    const registrada = await this.repositorio.registrarMensagemDoFuncionario(
      atendimentoId,
      ator,
      `Enviou ao cliente: ${descricao}`,
    );
    if (!registrada.ok) return registrada;
    if (registrada.value.status === "encerrada") {
      return err(new NotFoundError("O Atendimento já foi encerrado."));
    }
    if (registrada.value.status === "sem_autoridade") {
      return err(new ForbiddenError("Você não pode enviar documentos neste Atendimento."));
    }

    const enviado = await entregar(atendimento.telefone, registrada.value.id);
    await this.repositorio.finalizarEntregaDoFuncionario(registrada.value.id, enviado.ok);
    if (!enviado.ok) {
      await this.auditar(ator, atendimentoId, "falha");
      return enviado;
    }
    await this.auditar(ator, atendimentoId, "sucesso");
    return ok(undefined);
  }

  private async preparar(
    clienteId: string,
    documento: DocumentoParaEnviar,
  ): Promise<Result<Preparado, AppError>> {
    if (ehGuia(documento.tipo)) return this.prepararGuia(clienteId, documento.tipo);

    const lista = await this.documentos.listar(clienteId);
    if (!lista.ok) return lista;
    const escolhido = lista.value.find(
      (d) => d.tipo === documento.tipo && d.numero === documento.numero,
    );
    if (!escolhido) return err(new NotFoundError("O Cliente não tem esse documento."));
    const descricao = descreverDocumento(escolhido);
    return ok({
      descricao,
      entregar: (telefone, chaveIdempotencia) =>
        this.enviarArquivo(telefone, escolhido.caminho, descricao, chaveIdempotencia),
    });
  }

  // O CNPJ vem do cadastro do Cliente, como na URA. Sem autorização fiscal vigente o provedor
  // devolve `ForbiddenError`, que o painel mostra ao Funcionário.
  private async prepararGuia(
    clienteId: string,
    tipo: TipoGuia,
  ): Promise<Result<Preparado, AppError>> {
    let guia;
    try {
      guia = await this.guias.buscar(clienteId, tipo);
    } catch (erro) {
      // Só a mensagem: o objeto de erro inteiro poderia levar o CNPJ ao log.
      console.error(
        `Falha inesperada ao buscar a guia ${tipo}:`,
        erro instanceof Error ? erro.message : "erro desconhecido",
      );
      return err(new ServicoExternoError("Não foi possível buscar o documento agora."));
    }
    if (!guia.ok) return guia;
    const { nomeArquivo, pdfBase64 } = guia.value;
    return ok({
      descricao: ROTULO_GUIA[tipo],
      entregar: (telefone, chaveIdempotencia) =>
        this.despachar({ telefone, nomeArquivo, pdfBase64, chaveIdempotencia }),
    });
  }

  private async enviarArquivo(
    telefone: string,
    caminho: string,
    descricao: string,
    chaveIdempotencia: string,
  ): Promise<Result<void, AppError>> {
    const link = await this.documentos.linkTemporario(caminho);
    if (!link.ok) return link;
    const extensao = /\.[A-Za-z0-9]+$/.exec(caminho)?.[0] ?? "";
    return this.despachar({
      telefone,
      url: link.value,
      nomeArquivo: `${descricao}${extensao}`,
      chaveIdempotencia,
    });
  }

  private async despachar(documento: DocumentoEnviado): Promise<Result<void, AppError>> {
    try {
      return await this.envio.enviarDocumento(documento);
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
