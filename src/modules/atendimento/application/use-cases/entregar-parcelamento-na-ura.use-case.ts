import {
  atribuirGuiasParcelamento,
  identidadeDaGuia,
} from "@/modules/atendimento/application/jobs/atribuir-guias-parcelamento";
import type {
  EntregarParcelamentoNaUraInput,
  EntregarParcelamentoNaUraPort,
} from "@/modules/atendimento/application/ports/in/entregar-parcelamento-na-ura.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { GuiasParcelamentoPort } from "@/modules/atendimento/application/ports/out/guias-parcelamento.provider";
import type {
  ParcelamentoDoCliente,
  ParcelamentosDoClientePort,
} from "@/modules/atendimento/application/ports/out/parcelamentos-do-cliente.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import { chaveDoParcelamento } from "@/modules/atendimento/domain/services/guia-guardada.service";
import type { AppError } from "@/shared/errors/app.error";
import { mesAtual } from "@/shared/kernel/mes-atual";
import { ok, type Result } from "@/shared/kernel/result";

const SEM_PARCELAMENTO = "Não encontramos parcelamento vigente para a sua empresa.";
const TODOS_QUITADOS = "Todos os parcelamentos da sua empresa foram quitados.";

// `nova`: guia emitida agora, ainda sem envio nem registro. Sem ela a parcela já tem registro e o
// PDF guardado é reenviado. `parcela` null: não há guia para entregar.
type Alvo = { parcelamento: ParcelamentoDoCliente; parcela: string | null; nova?: GuiaFiscal };

// "AAAAMM" do mês anterior.
function mesAnterior(aaaamm: string): string {
  const ano = Number(aaaamm.slice(0, 4));
  const mes = Number(aaaamm.slice(4));
  return mes === 1 ? `${ano - 1}12` : `${ano}${String(mes - 1).padStart(2, "0")}`;
}

// A opção do parcelamento na URA segue a regra do job, mudando só o gatilho: para cada parcelamento
// comum em aberto, a parcela do mês ou, se o provedor ainda não a emite, a do mês anterior. Uma
// mensagem com PDF por parcelamento, identificada pelo código. Parcela com registro reenvia o PDF
// guardado, sem provedor e sem novo desconto; só a primeira entrega chama o provedor, registra o
// envio e desconta. Internos são ignorados e nunca mencionados. O banco decide "sem parcelamento" e
// "quitados" antes de qualquer chamada ao provedor.
// ponytail: sem a reserva por Cliente do job; job e URA simultâneos podem duplicar o PDF, nunca o
// desconto (o registro é único por parcela). Reservar se virar problema.
export class EntregarParcelamentoNaUra implements EntregarParcelamentoNaUraPort {
  constructor(
    private readonly parcelamentos: ParcelamentosDoClientePort,
    private readonly guias: GuiasParcelamentoPort,
    private readonly publicadas: GuiaPublicadaPort,
    private readonly envio: EnvioMensagemPort,
    private readonly relogio: RelogioPort,
  ) {}

  async execute({
    clienteId,
    telefone,
  }: EntregarParcelamentoNaUraInput): Promise<Result<void, AppError>> {
    const emAberto = await this.parcelamentos.listarEmAberto(clienteId);
    if (!emAberto.ok) return emAberto;
    const comuns = emAberto.value.filter((p) => !p.interno);
    if (comuns.length === 0) {
      const total = await this.parcelamentos.contarComuns(clienteId);
      if (!total.ok) return total;
      const texto = total.value === 0 ? SEM_PARCELAMENTO : TODOS_QUITADOS;
      return this.envio.enviar({ telefone, texto });
    }

    const alvos = await this.definirAlvos(clienteId, emAberto.value);
    if (!alvos.ok) return alvos;

    const falhas: string[] = [];
    for (const alvo of alvos.value) {
      if (!(await this.entregar(clienteId, telefone, alvo))) falhas.push(alvo.parcelamento.codigo);
    }
    if (falhas.length === 0) return ok(undefined);
    return this.envio.enviar({
      telefone,
      texto: `Não conseguimos enviar a guia do parcelamento ${falhas.join(", ")}. Tente novamente em alguns minutos ou fale com o escritório.`,
    });
  }

  // O provedor só é chamado se algum comum ainda não tem a parcela do mês registrada. O erro dele
  // (sem autorização, fora do ar) sobe antes de qualquer envio.
  private async definirAlvos(
    clienteId: string,
    emAberto: ParcelamentoDoCliente[],
  ): Promise<Result<Alvo[], AppError>> {
    const mes = mesAtual(this.relogio.agora()).replace("-", "");
    const anterior = mesAnterior(mes);
    const comuns = emAberto.filter((p) => !p.interno);
    const novas = new Map<string, { parcela: string; guia: GuiaFiscal }>();
    if (comuns.some((p) => !p.parcelasEnviadas.includes(mes))) {
      const jaRecebidas = comuns[0].parcelasEnviadas.filter((parcela) =>
        comuns.every((p) => p.parcelasEnviadas.includes(parcela)),
      );
      const buscadas = await this.guias.buscarGuiasParcelamento(clienteId, jaRecebidas);
      if (!buscadas.ok) return buscadas;
      const entregues = await this.parcelamentos.guiasEntregues(clienteId);
      if (!entregues.ok) return entregues;
      // A atribuição vê todos os em aberto: a guia de um interno não cai num comum.
      const atribuidas = atribuirGuiasParcelamento(buscadas.value, emAberto, entregues.value);
      for (const { parcelamento, guia, parcela } of atribuidas) {
        if (parcela !== mes && parcela !== anterior) continue;
        if (novas.get(parcelamento.id)?.parcela !== mes)
          novas.set(parcelamento.id, { parcela, guia });
      }
    }
    return ok(
      comuns.map((parcelamento) => {
        if (parcelamento.parcelasEnviadas.includes(mes)) return { parcelamento, parcela: mes };
        const nova = novas.get(parcelamento.id);
        if (nova) return { parcelamento, parcela: nova.parcela, nova: nova.guia };
        const guardada = parcelamento.parcelasEnviadas.includes(anterior);
        return { parcelamento, parcela: guardada ? anterior : null };
      }),
    );
  }

  // `true` se o contato recebeu o PDF.
  private async entregar(
    clienteId: string,
    telefone: string,
    { parcelamento, parcela, nova }: Alvo,
  ): Promise<boolean> {
    if (!parcela) return false;
    const chave = chaveDoParcelamento(parcelamento.id, parcela);
    const nomeArquivo = `parcelamento-${parcelamento.codigo}-${parcela}.pdf`;
    const url = nova
      ? await this.publicadas.publicar(clienteId, nova, chave)
      : await this.publicadas.reencontrar(clienteId, chave);
    if (!url.ok || !url.value) return false;
    const enviada = await this.envio.enviarDocumento({ telefone, nomeArquivo, url: url.value });
    if (!enviada.ok || !nova) return enviada.ok;

    // A guia já saiu: se o registro falha, o contato recebeu e o rastro fica no log.
    const registro = await this.parcelamentos.registrarEnvio(
      parcelamento.id,
      parcela,
      identidadeDaGuia(nova),
    );
    if (!registro.ok || registro.value === "nao_elegivel") {
      console.error("Guia de parcelamento entregue pela URA, mas o envio não foi registrado.");
    }
    return true;
  }
}
