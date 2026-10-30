import type {
  Cliente,
  ClienteId,
  ClienteProps,
} from "@/modules/clientes/domain/entities/cliente.entity";
import { AlteracaoContratual } from "@/modules/clientes/domain/value-objects/alteracao-contratual.vo";
import { AtividadeMensal } from "@/modules/clientes/domain/value-objects/atividade-mensal.vo";
import { Cnpj } from "@/modules/clientes/domain/value-objects/cnpj.vo";
import { Contato } from "@/modules/clientes/domain/value-objects/contato.vo";
import { DasStatus } from "@/modules/clientes/domain/value-objects/das-status.vo";
import { DocumentoObrigatorioStatus } from "@/modules/clientes/domain/value-objects/documento-obrigatorio-status.vo";
import { Email } from "@/modules/clientes/domain/value-objects/email.vo";
import { FormaEnvio } from "@/modules/clientes/domain/value-objects/forma-envio.vo";
import { Regime } from "@/modules/clientes/domain/value-objects/regime.vo";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export type AlteracaoContratualRestaurar = {
  numero: number;
  data: string;
  arquivoCaminho: string;
};
export type ContatoRestaurar = { id?: string; nome: string; telefone: string; padrao: boolean };
export type AtividadeMensalRestaurar = {
  anoMes: string;
  industria: boolean;
  comercio: boolean;
  servico: boolean;
};

export type ClienteRestaurar = {
  id: string;
  empresa: string;
  cnpj: string;
  regime: string;
  contratoSocialCaminho: string | null;
  email?: string | null;
  alteracoesContratuais: AlteracaoContratualRestaurar[];
  formaEnvio?: string;
  contatos?: ContatoRestaurar[];
  documentoObrigatorio?: string | null;
  dasStatus?: string | null;
  dataEnvioDas?: string | null;
  observacoesGerais?: string;
  atividadeMesAtual?: AtividadeMensalRestaurar | null;
};

export class ClienteBuilder {
  private id?: ClienteId;
  private empresa?: string;
  private cnpj?: Cnpj;
  private regime?: Regime;
  // Opcional — sem sentinela `undefined` pra
  // distinguir "setter nunca chamado" porque não há mais checagem de presença.
  private contratoSocialCaminho: string | null = null;
  private email: Email | null = null;
  private alteracoesContratuais: AlteracaoContratual[] = [];
  // Campos operacionais do Simples Nacional — todos opcionais/com default, igual a
  // contratoSocialCaminho: um Cliente recém-criado ainda não tem nenhum deles preenchido.
  // formaEnvio só vira VO no build() (default "whatsapp" quando o setter nunca foi chamado).
  private formaEnvio: FormaEnvio | null = null;
  private contatos: Contato[] = [];
  private documentoObrigatorio: DocumentoObrigatorioStatus | null = null;
  private dasStatus: DasStatus | null = null;
  private dataEnvioDas: Date | null = null;
  private observacoesGerais = "";
  private atividadeMesAtual: AtividadeMensal | null = null;
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
    if (!resultado.ok) {
      this.camposInvalidos.cnpj = [resultado.error.message];
      return this;
    }
    this.cnpj = resultado.value;
    return this;
  }

  comRegime(entrada: string): this {
    const resultado = Regime.criar(entrada);
    if (!resultado.ok) {
      this.camposInvalidos.regime = [resultado.error.message];
      return this;
    }
    this.regime = resultado.value;
    return this;
  }

  comContratoSocialCaminho(caminho: string | null): this {
    this.contratoSocialCaminho = caminho;
    return this;
  }

  // Vazio ou só espaços é "sem e-mail".
  comEmail(entrada: string | null): this {
    const texto = entrada?.trim();
    if (!texto) {
      this.email = null;
      return this;
    }
    const resultado = Email.criar(texto);
    if (!resultado.ok) {
      this.camposInvalidos.email = [resultado.error.message];
      return this;
    }
    this.email = resultado.value;
    return this;
  }

  comAlteracoesContratuais(entradas: AlteracaoContratualRestaurar[]): this {
    const erros: string[] = [];
    this.alteracoesContratuais = entradas.flatMap((entrada, indice) =>
      this.validarAlteracao(entrada, indice, erros),
    );
    const numeros = this.alteracoesContratuais.map((alteracao) => alteracao.numero);
    if (new Set(numeros).size !== numeros.length) erros.push("nº repetido");
    if (erros.length > 0) this.camposInvalidos.alteracoesContratuais = erros;
    return this;
  }

  private validarAlteracao(
    entrada: AlteracaoContratualRestaurar,
    indice: number,
    erros: string[],
  ): AlteracaoContratual[] {
    const resultado = AlteracaoContratual.criar(
      entrada.numero,
      entrada.data,
      entrada.arquivoCaminho,
    );
    if (!resultado.ok) {
      erros.push(`item ${indice + 1}: ${resultado.error.message}`);
      return [];
    }
    return [resultado.value];
  }

  comFormaEnvio(entrada: string): this {
    const resultado = FormaEnvio.criar(entrada);
    if (!resultado.ok) {
      this.camposInvalidos.formaEnvio = [resultado.error.message];
      return this;
    }
    this.formaEnvio = resultado.value;
    return this;
  }

  comContatos(entradas: ContatoRestaurar[]): this {
    const erros: string[] = [];
    this.contatos = entradas.flatMap((entrada, indice) =>
      this.validarContato(entrada, indice, erros),
    );
    if (erros.length > 0) this.camposInvalidos.contatos = erros;
    return this;
  }

  private validarContato(entrada: ContatoRestaurar, indice: number, erros: string[]): Contato[] {
    const resultado = Contato.criar(entrada);
    if (!resultado.ok) {
      erros.push(`item ${indice + 1}: ${resultado.error.message}`);
      return [];
    }
    return [resultado.value];
  }

  comDocumentoObrigatorio(entrada: string | null): this {
    if (entrada === null) {
      this.documentoObrigatorio = null;
      return this;
    }
    const resultado = DocumentoObrigatorioStatus.criar(entrada);
    if (!resultado.ok) {
      this.camposInvalidos.documentoObrigatorio = [resultado.error.message];
      return this;
    }
    this.documentoObrigatorio = resultado.value;
    return this;
  }

  comDasStatus(entrada: string | null): this {
    if (entrada === null) {
      this.dasStatus = null;
      return this;
    }
    const resultado = DasStatus.criar(entrada);
    if (!resultado.ok) {
      this.camposInvalidos.dasStatus = [resultado.error.message];
      return this;
    }
    this.dasStatus = resultado.value;
    return this;
  }

  comDataEnvioDas(data: Date | null): this {
    this.dataEnvioDas = data;
    return this;
  }

  comObservacoesGerais(texto: string): this {
    this.observacoesGerais = texto;
    return this;
  }

  comAtividadeMesAtual(entrada: AtividadeMensalRestaurar | null): this {
    if (entrada === null) {
      this.atividadeMesAtual = null;
      return this;
    }
    const resultado = AtividadeMensal.criar(entrada);
    this.atividadeMesAtual = resultado.ok ? resultado.value : null;
    return this;
  }

  restaurar(dados: ClienteRestaurar): this {
    this.comId(dados.id)
      .comEmpresa(dados.empresa)
      .comCnpj(dados.cnpj)
      .comRegime(dados.regime)
      .comContratoSocialCaminho(dados.contratoSocialCaminho)
      .comAlteracoesContratuais(dados.alteracoesContratuais);
    if (dados.email !== undefined) this.comEmail(dados.email);
    if (dados.formaEnvio !== undefined) this.comFormaEnvio(dados.formaEnvio);
    if (dados.contatos !== undefined) this.comContatos(dados.contatos);
    if (dados.documentoObrigatorio !== undefined)
      this.comDocumentoObrigatorio(dados.documentoObrigatorio);
    if (dados.dasStatus !== undefined) this.comDasStatus(dados.dasStatus);
    if (dados.dataEnvioDas !== undefined) {
      this.comDataEnvioDas(dados.dataEnvioDas ? new Date(dados.dataEnvioDas) : null);
    }
    if (dados.observacoesGerais !== undefined) this.comObservacoesGerais(dados.observacoesGerais);
    if (dados.atividadeMesAtual !== undefined) this.comAtividadeMesAtual(dados.atividadeMesAtual);
    return this;
  }

  build(): Result<Cliente, ValidationError> {
    // Presença checada aqui, não nos setters: um setter nunca chamado não deixa
    // rastro em camposInvalidos, e os `!` abaixo mascarariam undefined em runtime.
    // O guard `!this.camposInvalidos.X` evita sobrescrever a mensagem específica
    // que comCnpj/comRegime já registraram quando FORAM chamados com um valor
    // inválido — só entra quando o setter nunca rodou.
    if (!this.id) this.camposInvalidos.id = ["obrigatório"];
    if (this.empresa === undefined) this.camposInvalidos.empresa = ["obrigatório"];
    if (this.cnpj === undefined && !this.camposInvalidos.cnpj)
      this.camposInvalidos.cnpj = ["obrigatório"];
    if (this.regime === undefined && !this.camposInvalidos.regime)
      this.camposInvalidos.regime = ["obrigatório"];

    // Invariante do agregado: se há contatos, exatamente 1 é padrão —
    // checado aqui (não em comContatos) pelo mesmo motivo do resto do build():
    // é uma regra sobre o conjunto final, não sobre um item isolado.
    if (
      !this.camposInvalidos.contatos &&
      this.contatos.length > 0 &&
      this.contatos.filter((c) => c.padrao).length !== 1
    ) {
      this.camposInvalidos.contatos = ["Deve haver exatamente um contato marcado como padrão"];
    }

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
        email: this.email,
        alteracoesContratuais: this.alteracoesContratuais,
        formaEnvio: this.formaEnvio ?? formaEnvioPadrao(),
        contatos: this.contatos,
        documentoObrigatorio: this.documentoObrigatorio,
        dasStatus: this.dasStatus,
        dataEnvioDas: this.dataEnvioDas,
        observacoesGerais: this.observacoesGerais,
        atividadeMesAtual: this.atividadeMesAtual,
      }),
    );
  }
}

function formaEnvioPadrao(): FormaEnvio {
  const resultado = FormaEnvio.criar("whatsapp");
  if (!resultado.ok) throw new Error("valor padrão de FormaEnvio inválido — bug no VO");
  return resultado.value;
}
