import type { LembretesExecutados } from "@/modules/atendimento/application/ports/in/executar-lembretes-documento-e-das.provider";
import type {
  AlertaSetorPort,
  TipoAlertaSetor,
} from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type { ClienteParaLembrete } from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";

// Estado de uma rodada do job: os contadores do resumo e os alertas já levantados, por Cliente e
// tipo (um Cliente com lembrete e DAS não alerta duas vezes o mesmo problema). Nasce a cada
// execução, o que mantém o use case sem estado.
export class RodadaLembretes {
  readonly resumo: LembretesExecutados;
  private readonly alertados = new Set<string>();

  constructor(
    private readonly alertas: AlertaSetorPort,
    executado: boolean,
  ) {
    this.resumo = { executado, lembretes: 0, dasEnviados: 0, alertas: 0, falhas: 0 };
  }

  registrarLembrete() {
    this.resumo.lembretes += 1;
  }

  registrarDasEnviado() {
    this.resumo.dasEnviados += 1;
  }

  registrarFalha() {
    this.resumo.falhas += 1;
  }

  async alertar(cliente: ClienteParaLembrete, tipo: TipoAlertaSetor, mensagem: string) {
    const chave = `${cliente.clienteId}:${tipo}`;
    if (this.alertados.has(chave)) return;
    this.alertados.add(chave);
    const gravado = await this.alertas.alertar({
      setor: "simples_nacional",
      tipo,
      clienteId: cliente.clienteId,
      mensagem,
    });
    if (gravado.ok) this.resumo.alertas += 1;
    else this.registrarFalha();
  }

  async falhou(cliente: ClienteParaLembrete, mensagem: string) {
    this.registrarFalha();
    await this.alertar(cliente, "falha_envio", mensagem);
  }
}
