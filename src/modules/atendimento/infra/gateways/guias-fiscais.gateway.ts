import type { ClienteCnpjPort } from "@/modules/atendimento/application/ports/out/cliente-cnpj.provider";
import type {
  GuiaFiscal,
  GuiasFiscaisPort,
  TipoGuia,
} from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { GuiasParcelamentoPort } from "@/modules/atendimento/application/ports/out/guias-parcelamento.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// O que este gateway usa das obrigações fiscais; o `main` entrega o adapter de `clientes`
// (arquitetura.md 3.11: módulos não se importam, a forma é a mesma da porta de lá).
export interface ObrigacoesFiscais {
  consultarAutorizacao(cnpj: string): Promise<Result<{ vigente: boolean }, AppError>>;
  buscarDas(cnpj: string): Promise<Result<GuiaFiscal, AppError>>;
  buscarGuiasParcelamento(
    cnpj: string,
    pedido: { regime: "simples_nacional" | "mei"; ignorar: readonly string[] },
  ): Promise<Result<GuiaFiscal[], AppError>>;
}

// A CND vem de fonte própria (porta separada em `clientes`).
export interface CertidaoCnd {
  buscarCnd(cnpj: string): Promise<Result<GuiaFiscal, AppError>>;
}

export class GuiasFiscaisGateway implements GuiasFiscaisPort, GuiasParcelamentoPort {
  constructor(
    private readonly clientes: ClienteCnpjPort,
    private readonly obrigacoes: ObrigacoesFiscais,
    private readonly certidoes: CertidaoCnd,
  ) {}

  async buscar(clienteId: string, tipo: TipoGuia): Promise<Result<GuiaFiscal, AppError>> {
    if (tipo === "parcelamento") return this.guiaMaisAtrasada(clienteId);
    const cadastro = await this.clientes.cadastroFiscalDoCliente(clienteId);
    if (!cadastro.ok) return cadastro;
    const { cnpj } = cadastro.value;
    const autorizacao = await this.obrigacoes.consultarAutorizacao(cnpj);
    if (!autorizacao.ok) return autorizacao;
    if (!autorizacao.value.vigente) {
      return err(new ForbiddenError("Cliente sem autorização vigente para consulta fiscal."));
    }
    return tipo === "das" ? this.obrigacoes.buscarDas(cnpj) : this.certidoes.buscarCnd(cnpj);
  }

  async buscarGuiasParcelamento(
    clienteId: string,
    ignorar: readonly string[],
  ): Promise<Result<GuiaFiscal[], AppError>> {
    const cadastro = await this.clientes.cadastroFiscalDoCliente(clienteId);
    if (!cadastro.ok) return cadastro;
    const { cnpj, regime } = cadastro.value;
    // Só o Simples Nacional e o MEI têm parcelamento ordinário nesse provedor.
    if (regime !== "simples_nacional" && regime !== "mei") {
      return err(new ValidationError("Este regime não tem guia de parcelamento do Simples."));
    }
    // Direto, sem pré-consulta: o provedor consulta a autorização só se a emissão falhar.
    return this.obrigacoes.buscarGuiasParcelamento(cnpj, { regime, ignorar });
  }

  // ponytail: o painel do Funcionário entrega uma guia só, a mais atrasada; a URA usa `EntregarParcelamentoNaUra`.
  private async guiaMaisAtrasada(clienteId: string): Promise<Result<GuiaFiscal, AppError>> {
    const guias = await this.buscarGuiasParcelamento(clienteId, []);
    if (!guias.ok) return guias;
    const [maisAtrasada] = [...guias.value].sort((a, b) =>
      (a.parcela ?? "").localeCompare(b.parcela ?? ""),
    );
    return maisAtrasada
      ? ok(maisAtrasada)
      : err(new ServicoExternoError("Cliente sem guia de parcelamento disponível."));
  }
}
