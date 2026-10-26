import type {
  EntregarDasNaUraInput,
  EntregarDasNaUraPort,
} from "@/modules/atendimento/application/ports/in/entregar-das-na-ura.provider";
import type { ObterGuiaDasParaEnvioPort } from "@/modules/atendimento/application/ports/in/obter-guia-das-para-envio.provider";
import type { ClientesParaLembretePort } from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import { chaveDoDas } from "@/modules/atendimento/application/use-cases/obter-guia-das-para-envio.use-case";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { hojeIso, mesAtual } from "@/shared/kernel/mes-atual";
import { err, ok, type Result } from "@/shared/kernel/result";

const DAS_NAO_PRONTO =
  "O DAS deste mês ainda não está pronto. Assim que estiver, o escritório envia para você.";

// A opção do DAS na URA segue o processo do job: o banco manda. Não pronto → só avisa (sem provedor
// e sem alerta ao setor: só o job abre). Pronto → o pedido adianta o envio; o DAS só vira enviado
// (data de hoje, URA como ator) depois do aceite da entrega, com a mesma reserva do job, que por
// isso não o reenvia. Já enviado → reenvia a guia guardada, sem provedor.
export class EntregarDasNaUra implements EntregarDasNaUraPort {
  constructor(
    private readonly clientes: Pick<
      ClientesParaLembretePort,
      "obterDas" | "reservarDas" | "concluirDas" | "liberarDas"
    >,
    private readonly guiaDas: ObterGuiaDasParaEnvioPort,
    private readonly publicadas: Pick<GuiaPublicadaPort, "reencontrar">,
    private readonly envio: EnvioMensagemPort,
    private readonly relogio: RelogioPort,
  ) {}

  async execute({ clienteId, telefone }: EntregarDasNaUraInput): Promise<Result<void, AppError>> {
    const das = await this.clientes.obterDas(clienteId);
    if (!das.ok) return das;
    if (das.value?.dasStatus === "enviado" && das.value.dataEnvioDas) {
      const chave = chaveDoDas(das.value.dataEnvioDas.slice(0, 7));
      const url = await this.publicadas.reencontrar(clienteId, chave);
      if (!url.ok) return url;
      if (!url.value) return err(new ServicoExternoError("Guia do DAS enviada não está guardada."));
      return this.envio.enviarDocumento({
        telefone,
        nomeArquivo: `das-${chave.parcela}.pdf`,
        url: url.value,
      });
    }
    if (das.value?.dasStatus !== "pronto") {
      return this.envio.enviar({ telefone, texto: DAS_NAO_PRONTO });
    }
    return this.adiantar(clienteId, telefone);
  }

  private async adiantar(clienteId: string, telefone: string): Promise<Result<void, AppError>> {
    const reserva = await this.clientes.reservarDas(clienteId);
    if (!reserva.ok) return reserva;
    if (reserva.value === null) {
      return err(
        new ServicoExternoError("DAS em envio por outra tentativa ou já não está pronto."),
      );
    }
    const token = reserva.value;

    const agora = this.relogio.agora();
    const guia = await this.guiaDas.execute(clienteId, mesAtual(agora));
    const entrega = guia.ok
      ? await this.envio.enviarDocumento({ telefone, ...guia.value.guia })
      : guia;
    if (!entrega.ok) {
      await this.clientes.liberarDas(clienteId, token);
      return entrega;
    }
    // Se a conclusão não vale (cadastro mudou no meio) a guia já foi entregue: não vira erro.
    await this.clientes.concluirDas(clienteId, token, hojeIso(agora));
    return ok(undefined);
  }
}
