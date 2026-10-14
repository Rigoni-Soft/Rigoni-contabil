import { ClienteBuilder } from "@/modules/clientes/domain/builders/cliente.builder";
import type { AlteracaoContratual } from "@/modules/clientes/domain/value-objects/alteracao-contratual.vo";
import type { AtividadeMensal } from "@/modules/clientes/domain/value-objects/atividade-mensal.vo";
import type { Cnpj } from "@/modules/clientes/domain/value-objects/cnpj.vo";
import type { Contato } from "@/modules/clientes/domain/value-objects/contato.vo";
import type { DasStatus } from "@/modules/clientes/domain/value-objects/das-status.vo";
import type { DocumentoObrigatorioStatus } from "@/modules/clientes/domain/value-objects/documento-obrigatorio-status.vo";
import type { FormaEnvio } from "@/modules/clientes/domain/value-objects/forma-envio.vo";
import type { ParcelamentoStatus } from "@/modules/clientes/domain/value-objects/parcelamento-status.vo";
import type { Regime } from "@/modules/clientes/domain/value-objects/regime.vo";
import type { Id } from "@/shared/kernel/id.types";

export type ClienteId = Id<"Cliente">;

export type ClienteProps = {
  id: ClienteId;
  empresa: string;
  cnpj: Cnpj;
  regime: Regime;
  // Opcional (decisão de produto 2026-09-29, atualiza a spec #24): nem todo
  // Cliente tem o contrato social anexado no momento do cadastro.
  contratoSocialCaminho: string | null;
  // Opcional: destino do envio por e-mail do job de lembrete/DAS (#52).
  email: string | null;
  alteracoesContratuais: readonly AlteracaoContratual[];
  // Campos operacionais do Simples Nacional (#34) — editados pelo Funcionário
  // do setor, em tela separada do cadastro jurídico do #33.
  formaEnvio: FormaEnvio;
  contatos: readonly Contato[];
  documentoObrigatorio: DocumentoObrigatorioStatus | null;
  dasStatus: DasStatus | null;
  dataEnvioDas: Date | null;
  temParcelamento: boolean;
  parcelamentoStatus: ParcelamentoStatus | null;
  observacoesGerais: string;
  atividadeMesAtual: AtividadeMensal | null;
};

export class Cliente {
  private constructor(private readonly props: Readonly<ClienteProps>) {}

  static builder(): ClienteBuilder {
    return new ClienteBuilder((props) => new Cliente(props));
  }

  get id(): ClienteId {
    return this.props.id;
  }

  get empresa(): string {
    return this.props.empresa;
  }

  get cnpj(): Cnpj {
    return this.props.cnpj;
  }

  get regime(): Regime {
    return this.props.regime;
  }

  get contratoSocialCaminho(): string | null {
    return this.props.contratoSocialCaminho;
  }

  get email(): string | null {
    return this.props.email;
  }

  get alteracoesContratuais(): readonly AlteracaoContratual[] {
    return this.props.alteracoesContratuais;
  }

  get formaEnvio(): FormaEnvio {
    return this.props.formaEnvio;
  }

  get contatos(): readonly Contato[] {
    return this.props.contatos;
  }

  get documentoObrigatorio(): DocumentoObrigatorioStatus | null {
    return this.props.documentoObrigatorio;
  }

  get dasStatus(): DasStatus | null {
    return this.props.dasStatus;
  }

  get dataEnvioDas(): Date | null {
    return this.props.dataEnvioDas;
  }

  get temParcelamento(): boolean {
    return this.props.temParcelamento;
  }

  get parcelamentoStatus(): ParcelamentoStatus | null {
    return this.props.parcelamentoStatus;
  }

  get observacoesGerais(): string {
    return this.props.observacoesGerais;
  }

  get atividadeMesAtual(): AtividadeMensal | null {
    return this.props.atividadeMesAtual;
  }
}
