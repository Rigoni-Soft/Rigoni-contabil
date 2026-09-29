import type {
  Cliente,
  ClienteId,
  ClienteProps,
} from "@/modules/clientes/domain/entities/cliente.entity";
import { AlteracaoContratual } from "@/modules/clientes/domain/value-objects/alteracao-contratual.vo";
import { Cnpj } from "@/modules/clientes/domain/value-objects/cnpj.vo";
import { Regime } from "@/modules/clientes/domain/value-objects/regime.vo";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export type AlteracaoContratualRestaurar = { data: string; arquivoCaminho: string };

export type ClienteRestaurar = {
  id: string;
  empresa: string;
  cnpj: string;
  regime: string;
  contratoSocialCaminho: string | null;
  alteracoesContratuais: AlteracaoContratualRestaurar[];
};

export class ClienteBuilder {
  private id?: ClienteId;
  private empresa?: string;
  private cnpj?: Cnpj;
  private regime?: Regime;
  // Opcional (decisão de produto 2026-09-29) — sem sentinela `undefined` pra
  // distinguir "setter nunca chamado" porque não há mais checagem de presença.
  private contratoSocialCaminho: string | null = null;
  private alteracoesContratuais: AlteracaoContratual[] = [];
  private readonly camposInvalidos: Record<string, string[]> = {};

  constructor(private readonly criar: (props: ClienteProps) => Cliente) {}

  comId(id: string): this {
    this.id = id as ClienteId;
    return this;
  }

  comEmpresa(empresa: string): this {
    if (!empresa.trim()) this.camposInvalidos.empresa = ["obrigatório"];
    this.empresa = empresa;
    return this;
  }

  comCnpj(entrada: string): this {
    const resultado = Cnpj.criar(entrada);
    if (resultado.ok) this.cnpj = resultado.value;
    else this.camposInvalidos.cnpj = [resultado.error.message];
    return this;
  }

  comRegime(entrada: string): this {
    const resultado = Regime.criar(entrada);
    if (resultado.ok) this.regime = resultado.value;
    else this.camposInvalidos.regime = [resultado.error.message];
    return this;
  }

  comContratoSocialCaminho(caminho: string | null): this {
    this.contratoSocialCaminho = caminho;
    return this;
  }

  comAlteracoesContratuais(entradas: AlteracaoContratualRestaurar[]): this {
    const erros: string[] = [];
    this.alteracoesContratuais = entradas.flatMap((entrada, indice) =>
      this.validarAlteracao(entrada, indice, erros),
    );
    if (erros.length > 0) this.camposInvalidos.alteracoesContratuais = erros;
    return this;
  }

  private validarAlteracao(
    entrada: AlteracaoContratualRestaurar,
    indice: number,
    erros: string[],
  ): AlteracaoContratual[] {
    const resultado = AlteracaoContratual.criar(entrada.data, entrada.arquivoCaminho);
    if (!resultado.ok) {
      erros.push(`item ${indice + 1}: ${resultado.error.message}`);
      return [];
    }
    return [resultado.value];
  }

  restaurar(dados: ClienteRestaurar): this {
    return this.comId(dados.id)
      .comEmpresa(dados.empresa)
      .comCnpj(dados.cnpj)
      .comRegime(dados.regime)
      .comContratoSocialCaminho(dados.contratoSocialCaminho)
      .comAlteracoesContratuais(dados.alteracoesContratuais);
  }

  build(): Result<Cliente, ValidationError> {
    // Presença checada aqui, não nos setters: um setter nunca chamado não deixa
    // rastro em camposInvalidos, e os `!` abaixo mascarariam undefined em runtime
    // (mesmo achado da devolutiva #55, ponto 03, aplicado ao builder de Usuario).
    // O guard `!this.camposInvalidos.X` evita sobrescrever a mensagem específica
    // que comCnpj/comRegime já registraram quando FORAM chamados com um valor
    // inválido — só entra quando o setter nunca rodou.
    if (!this.id) this.camposInvalidos.id = ["obrigatório"];
    if (this.empresa === undefined) this.camposInvalidos.empresa = ["obrigatório"];
    if (this.cnpj === undefined && !this.camposInvalidos.cnpj)
      this.camposInvalidos.cnpj = ["obrigatório"];
    if (this.regime === undefined && !this.camposInvalidos.regime)
      this.camposInvalidos.regime = ["obrigatório"];

    if (Object.keys(this.camposInvalidos).length > 0) {
      return err(new ValidationError("Dados de cliente inválidos", { ...this.camposInvalidos }));
    }

    return ok(
      this.criar({
        id: this.id!,
        empresa: this.empresa!,
        cnpj: this.cnpj!,
        regime: this.regime!,
        contratoSocialCaminho: this.contratoSocialCaminho,
        alteracoesContratuais: this.alteracoesContratuais,
      }),
    );
  }
}
