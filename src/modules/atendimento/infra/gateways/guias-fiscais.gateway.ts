import type { ClienteCnpjPort } from "@/modules/atendimento/application/ports/out/cliente-cnpj.provider";
import type {
  GuiaFiscal,
  GuiasFiscaisPort,
  TipoGuia,
} from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, type Result } from "@/shared/kernel/result";

// O que este gateway usa das obrigações fiscais; o `main` entrega o adapter de `clientes`
// (arquitetura.md 3.11: módulos não se importam, a forma é a mesma da porta de lá).
export interface ObrigacoesFiscais {
  consultarAutorizacao(cnpj: string): Promise<Result<{ vigente: boolean }, AppError>>;
  buscarDas(cnpj: string): Promise<Result<GuiaFiscal, AppError>>;
  buscarGuiaParcelamento(cnpj: string): Promise<Result<GuiaFiscal, AppError>>;
}

// A CND vem de fonte própria (porta separada em `clientes`).
export interface CertidaoCnd {
  buscarCnd(cnpj: string): Promise<Result<GuiaFiscal, AppError>>;
}

export class GuiasFiscaisGateway implements GuiasFiscaisPort {
  constructor(
    private readonly clientes: ClienteCnpjPort,
    private readonly obrigacoes: ObrigacoesFiscais,
    private readonly certidoes: CertidaoCnd,
  ) {}

  async buscar(clienteId: string, tipo: TipoGuia): Promise<Result<GuiaFiscal, AppError>> {
    const cnpj = await this.clientes.cnpjDoCliente(clienteId);
    if (!cnpj.ok) return cnpj;
    const autorizacao = await this.obrigacoes.consultarAutorizacao(cnpj.value);
    if (!autorizacao.ok) return autorizacao;
    if (!autorizacao.value.vigente) {
      return err(new ForbiddenError("Cliente sem autorização vigente para consulta fiscal."));
    }
    switch (tipo) {
      case "das":
        return this.obrigacoes.buscarDas(cnpj.value);
      case "parcelamento":
        return this.obrigacoes.buscarGuiaParcelamento(cnpj.value);
      case "cnd":
        return this.certidoes.buscarCnd(cnpj.value);
    }
  }
}
