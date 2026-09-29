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
import type { AppError } from "@/shared/errors/app.error";
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

    // Opcional (decisão de produto 2026-09-29): só envia ao Storage quando o
    // Admin anexou um arquivo.
    let contratoSocialCaminho: string | null = null;
    if (input.contratoSocial) {
      const contratoSocial = await this.storage.enviar(
        `${id}/contrato-social/${input.contratoSocial.name}`,
        input.contratoSocial,
      );
      if (!contratoSocial.ok) return this.falhar(ator, input, contratoSocial);
      contratoSocialCaminho = contratoSocial.value.caminho;
    }

    const alteracoes = await this.enviarAlteracoes(id, input.alteracoesContratuais);
    if (!alteracoes.ok) return this.falhar(ator, input, alteracoes);

    const construido = Cliente.builder()
      .comId(id)
      .comEmpresa(input.empresa)
      .comCnpj(input.cnpj)
      .comRegime(input.regime)
      .comContratoSocialCaminho(contratoSocialCaminho)
      .comAlteracoesContratuais(alteracoes.value)
      .build();
    if (!construido.ok) return this.falhar(ator, input, construido);

    const salvo = await this.clientes.criar(construido.value);
    if (!salvo.ok) return this.falhar(ator, input, salvo);

    await this.registrarAuditoria(ator, input, "sucesso");
    return ok({ cliente: clienteParaDto(construido.value) });
  }

  private async enviarAlteracoes(
    clienteId: string,
    alteracoes: CriarClienteInput["alteracoesContratuais"],
  ): Promise<Result<AlteracaoContratualRestaurar[], AppError>> {
    const enviadas: AlteracaoContratualRestaurar[] = [];
    for (const [indice, alteracao] of alteracoes.entries()) {
      const enviado = await this.storage.enviar(
        `${clienteId}/alteracoes-contratuais/${indice}-${alteracao.arquivo.name}`,
        alteracao.arquivo,
      );
      if (!enviado.ok) return enviado;
      enviadas.push({ data: alteracao.data, arquivoCaminho: enviado.value.caminho });
    }
    return ok(enviadas);
  }

  private async falhar(
    ator: AtorSessaoDto,
    input: CriarClienteInput,
    resultadoComErro: { ok: false; error: AppError },
  ): Promise<Result<CriarClienteOutput, AppError>> {
    await this.registrarAuditoria(ator, input, "falha");
    return resultadoComErro;
  }

  private async registrarAuditoria(
    ator: AtorSessaoDto,
    input: CriarClienteInput,
    resultado: "sucesso" | "falha",
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
