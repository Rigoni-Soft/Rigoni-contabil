import { clienteParaDto } from "@/modules/clientes/application/mappers/cliente-para-dto.mapper";
import type {
  CriarClienteInput,
  CriarClienteOutput,
  CriarClientePort,
} from "@/modules/clientes/application/ports/in/criar-cliente.provider";
import type { ArquivoStoragePort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type { AuditoriaPort } from "@/modules/clientes/application/ports/out/auditoria.provider";
import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AlteracaoContratualRestaurar } from "@/modules/clientes/domain/builders/cliente.builder";
import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import { Cnpj } from "@/modules/clientes/domain/value-objects/cnpj.vo";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class CriarCliente implements CriarClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly clientes: ClienteRepository,
    private readonly storage: ArquivoStoragePort,
    private readonly auditoria: AuditoriaPort,
  ) {}

  async execute(input: CriarClienteInput): Promise<Result<CriarClienteOutput, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || ator.papel !== "admin") {
      return err(new ForbiddenError("Só Admin cadastra Cliente."));
    }

    const id = crypto.randomUUID();
    // Todo caminho enviado ao Storage entra aqui: qualquer falha depois do
    // primeiro upload remove tudo (devolutiva PR #64, ponto 3), em vez de
    // deixar documento jurídico órfão sem Cliente.
    const enviados: string[] = [];
    const criado = await this.cadastrar(id, input, enviados);
    if (criado.ok) return criado;
    return this.falhar(ator, input, id, criado.error, enviados);
  }

  private async cadastrar(
    id: string,
    input: CriarClienteInput,
    enviados: string[],
  ): Promise<Result<CriarClienteOutput, AppError>> {
    // Antes de qualquer upload: CNPJ inválido não deve nem tocar o Storage.
    const cnpj = Cnpj.criar(input.cnpj);
    if (!cnpj.ok) return cnpj;

    // Opcional (decisão de produto 2026-09-29): só envia ao Storage quando o
    // Admin anexou um arquivo.
    let contratoSocialCaminho: string | null = null;
    if (input.contratoSocial) {
      const contratoSocial = await this.storage.enviar(
        `${id}/contrato-social/${input.contratoSocial.name}`,
        input.contratoSocial,
      );
      if (!contratoSocial.ok) return contratoSocial;
      enviados.push(contratoSocial.value.caminho);
      contratoSocialCaminho = contratoSocial.value.caminho;
    }

    const alteracoes = await this.enviarAlteracoes(id, input.alteracoesContratuais, enviados);
    if (!alteracoes.ok) return alteracoes;

    const construido = Cliente.builder()
      .comId(id)
      .comEmpresa(input.empresa)
      .comCnpj(cnpj.value.valor)
      .comRegime(input.regime)
      .comContratoSocialCaminho(contratoSocialCaminho)
      .comAlteracoesContratuais(alteracoes.value)
      .build();
    if (!construido.ok) return construido;

    // A auditoria de sucesso é gravada pelo banco na mesma transação deste
    // INSERT (trigger em `clientes`): sem evento, o cadastro inteiro falha.
    const salvo = await this.clientes.criar(construido.value);
    if (!salvo.ok) return salvo;

    return ok({ cliente: clienteParaDto(construido.value) });
  }

  private async enviarAlteracoes(
    clienteId: string,
    alteracoes: CriarClienteInput["alteracoesContratuais"],
    enviados: string[],
  ): Promise<Result<AlteracaoContratualRestaurar[], AppError>> {
    const restauradas: AlteracaoContratualRestaurar[] = [];
    for (const [indice, alteracao] of alteracoes.entries()) {
      const enviado = await this.storage.enviar(
        `${clienteId}/alteracoes-contratuais/${indice}-${alteracao.arquivo.name}`,
        alteracao.arquivo,
      );
      if (!enviado.ok) return enviado;
      enviados.push(enviado.value.caminho);
      restauradas.push({ data: alteracao.data, arquivoCaminho: enviado.value.caminho });
    }
    return ok(restauradas);
  }

  // Falha da própria compensação não é mascarada como o erro original: vira
  // `EstadoInconsistenteError` (objetos podem ter ficado órfãos) + auditoria
  // `falha_compensacao` + log com os caminhos — caminho de reconciliação manual,
  // mesmo padrão do cadastro de usuário (#30/PR #61).
  private async falhar(
    ator: AtorSessaoDto,
    input: CriarClienteInput,
    clienteId: string,
    erro: AppError,
    enviados: string[],
  ): Promise<Result<CriarClienteOutput, AppError>> {
    const removido = await this.removerEnviados(enviados);
    if (removido.ok) {
      await this.registrarAuditoria(ator, input, "falha");
      return err(erro);
    }

    console.error(
      `Falha ao compensar uploads órfãos (cliente=${clienteId}, cnpj=${input.cnpj}, caminhos=${enviados.join(",")}):`,
      removido.error.message,
    );
    await this.registrarAuditoria(ator, input, "falha_compensacao");
    return err(
      new EstadoInconsistenteError(
        "O cadastro falhou e não foi possível remover os documentos enviados. Avise o suporte.",
        clienteId,
      ),
    );
  }

  private async removerEnviados(enviados: string[]): Promise<Result<void, AppError>> {
    return enviados.length === 0 ? ok(undefined) : this.storage.remover(enviados);
  }

  private async registrarAuditoria(
    ator: AtorSessaoDto,
    input: CriarClienteInput,
    resultado: "falha" | "falha_compensacao",
  ): Promise<void> {
    await this.auditoria.registrar({
      ator: ator.id,
      setor: ator.setor,
      acao: "cliente.criar",
      alvo: input.cnpj,
      resultado,
    });
  }
}
