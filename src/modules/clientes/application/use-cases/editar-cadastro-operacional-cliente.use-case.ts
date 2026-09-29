import type {
  EditarCadastroOperacionalClienteInput,
  EditarCadastroOperacionalClienteOutput,
  EditarCadastroOperacionalClientePort,
} from "@/modules/clientes/application/ports/in/editar-cadastro-operacional-cliente.provider";
import type { AuditoriaPort } from "@/modules/clientes/application/ports/out/auditoria.provider";
import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class EditarCadastroOperacionalCliente implements EditarCadastroOperacionalClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly clientes: ClienteRepository,
    private readonly auditoria: AuditoriaPort,
  ) {}

  async execute(
    input: EditarCadastroOperacionalClienteInput,
  ): Promise<Result<EditarCadastroOperacionalClienteOutput, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !this.podeEditar(ator)) {
      return err(
        new ForbiddenError("Só Admin ou Funcionário do Simples Nacional editam este cadastro."),
      );
    }

    const clienteAtual = await this.clientes.buscarPorId(input.clienteId);
    if (!clienteAtual.ok) return clienteAtual;
    if (!clienteAtual.value) {
      return err(new ForbiddenError(`Cliente ${input.clienteId} não encontrado.`));
    }

    const construido = this.reconstruir(clienteAtual.value, input);
    if (!construido.ok) {
      await this.registrarAuditoria(ator, clienteAtual.value, "falha");
      return construido;
    }

    const salvo = await this.clientes.atualizarOperacional(construido.value);
    if (!salvo.ok) {
      await this.registrarAuditoria(ator, clienteAtual.value, "falha");
      return salvo;
    }

    await this.registrarAuditoria(ator, clienteAtual.value, "sucesso");
    return ok({ clienteId: input.clienteId });
  }

  private podeEditar(ator: AtorSessaoDto): boolean {
    return (
      ator.papel === "admin" || (ator.papel === "funcionario" && ator.setor === "simples_nacional")
    );
  }

  private reconstruir(
    clienteAtual: Cliente,
    input: EditarCadastroOperacionalClienteInput,
  ): Result<Cliente, AppError> {
    return Cliente.builder()
      .restaurar({
        id: clienteAtual.id,
        empresa: clienteAtual.empresa,
        cnpj: clienteAtual.cnpj.digitos,
        regime: clienteAtual.regime.valor,
        contratoSocialCaminho: clienteAtual.contratoSocialCaminho,
        alteracoesContratuais: clienteAtual.alteracoesContratuais.map((alteracao) => ({
          data: alteracao.data.toISOString().slice(0, 10),
          arquivoCaminho: alteracao.arquivoCaminho,
        })),
        formaEnvio: input.formaEnvio,
        contatos: input.contatos,
        documentoObrigatorio: input.documentoObrigatorio,
        dasStatus: input.dasStatus,
        dataEnvioDas: input.dataEnvioDas,
        temParcelamento: input.temParcelamento,
        parcelamentoStatus: input.parcelamentoStatus,
        observacoesGerais: input.observacoesGerais,
        atividadeMesAtual: {
          anoMes: new Date().toISOString().slice(0, 7),
          industria: input.atividadeMes.industria,
          comercio: input.atividadeMes.comercio,
          servico: input.atividadeMes.servico,
        },
      })
      .build();
  }

  private async registrarAuditoria(
    ator: AtorSessaoDto,
    cliente: Cliente,
    resultado: "sucesso" | "falha",
  ): Promise<void> {
    await this.auditoria.registrar({
      ator: ator.id,
      setor: ator.setor,
      acao: "cliente.editar-operacional",
      alvo: cliente.cnpj.digitos,
      resultado,
    });
  }
}
