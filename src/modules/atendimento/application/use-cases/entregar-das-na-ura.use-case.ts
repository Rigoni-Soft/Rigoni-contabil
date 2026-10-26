import type {
  EntregarNaUraInput,
  EntregarNaUraPort,
} from "@/modules/atendimento/application/ports/in/entregar-na-ura.provider";
import type { ObterGuiaDasParaEnvioPort } from "@/modules/atendimento/application/ports/in/obter-guia-das-para-envio.provider";
import type { ClientesParaLembretePort } from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import { chaveDoDas } from "@/modules/atendimento/domain/services/guia-guardada.service";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { hojeIso, mesAtual } from "@/shared/kernel/mes-atual";
import { err, ok, type Result } from "@/shared/kernel/result";

const DAS_NAO_PRONTO =
  "O DAS deste mês ainda não está pronto. Assim que estiver, o escritório envia para você.";
const DAS_EM_ENVIO =
  "Estamos enviando o seu DAS neste momento. Se ele não chegar em alguns minutos, fale com o escritório.";

// A opção do DAS na URA segue o processo do job: o banco manda. Não pronto → só avisa (sem provedor
// e sem alerta ao setor: só o job abre). Pronto → o pedido adianta o envio; o DAS só vira enviado
// (data de hoje, URA como ator) depois do aceite da entrega, com a mesma reserva do job, que por
// isso não o reenvia. Já enviado → reenvia a guia guardada, sem provedor.
export class EntregarDasNaUra implements EntregarNaUraPort {
  constructor(
    private readonly clientes: Pick<
      ClientesParaLembretePort,
      "obterDas" | "reservarDas" | "concluirDas" | "liberarDas"
    >,
    private readonly guiaDas: ObterGuiaDasParaEnvioPort,
    private readonly publicadas: Pick<GuiaPublicadaPort, "reencontrar" | "descartar">,
    private readonly envio: EnvioMensagemPort,
    private readonly relogio: RelogioPort,
  ) {}

  async execute({ clienteId, telefone }: EntregarNaUraInput): Promise<Result<void, AppError>> {
    const das = await this.clientes.obterDas(clienteId);
    if (!das.ok) return das;
    if (das.value?.dasStatus === "enviado") {
      // O sistema sempre grava a data junto do `enviado`; sem ela (dado legado) a chave do mês de
      // hoje é a melhor aposta, e sem PDF guardado cai no erro de guia indisponível.
      const chave = chaveDoDas(das.value.dataEnvioDas ?? hojeIso(this.relogio.agora()));
      const url = await this.publicadas.reencontrar(clienteId, chave);
      if (!url.ok) return url;
      if (!url.value) return err(new ServicoExternoError("Guia do DAS enviada não está guardada."));
      return this.envio.enviarDocumento({
        telefone,
        nomeArquivo: `das-${chave.periodo}.pdf`,
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
    // Outra tentativa (job ou outro pedido) está entregando, ou o DAS deixou de estar pronto.
    if (reserva.value === null) return this.envio.enviar({ telefone, texto: DAS_EM_ENVIO });

    const agora = this.relogio.agora();
    const guia = await this.guiaDas.execute(clienteId, mesAtual(agora));
    const entrega = guia.ok
      ? await this.envio.enviarDocumento({ telefone, ...guia.value.guia })
      : guia;
    if (!entrega.ok) {
      if (guia.ok) await this.publicadas.descartar(clienteId, chaveDoDas(mesAtual(agora)));
      await this.clientes.liberarDas(clienteId, reserva.value);
      return entrega;
    }
    // A guia já saiu: se a conclusão não vale (reserva substituída ou cadastro alterado no meio) o
    // DAS segue pronto e o job pode reenviá-la. Não vira erro para o contato, mas deixa rastro.
    const concluida = await this.clientes.concluirDas(clienteId, reserva.value, hojeIso(agora));
    if (!concluida.ok || !concluida.value) {
      console.error("DAS entregue pela URA, mas o cadastro não foi marcado como enviado.");
    }
    return ok(undefined);
  }
}
