import { ClienteBuilder } from "@/modules/clientes/domain/builders/cliente.builder";
import type { AlteracaoContratual } from "@/modules/clientes/domain/value-objects/alteracao-contratual.vo";
import type { Cnpj } from "@/modules/clientes/domain/value-objects/cnpj.vo";
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
  alteracoesContratuais: readonly AlteracaoContratual[];
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

  get alteracoesContratuais(): readonly AlteracaoContratual[] {
    return this.props.alteracoesContratuais;
  }
}
