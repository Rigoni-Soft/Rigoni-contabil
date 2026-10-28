import {
  atribuirGuiasParcelamento,
  identidadeDaGuia,
} from "@/modules/atendimento/application/jobs/atribuir-guias-parcelamento";
import {
  guiaPgfn,
  guiaPgfnAReenviar,
  guiasPgfnAEntregar,
  reservarELerGuiaPgfn,
} from "@/modules/atendimento/application/jobs/guias-pgfn-a-entregar";
import type {
  EntregarNaUraInput,
  EntregarNaUraPort,
} from "@/modules/atendimento/application/ports/in/entregar-na-ura.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type { GuiaFiscal } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { GuiasParcelamentoPort } from "@/modules/atendimento/application/ports/out/guias-parcelamento.provider";
import type {
  GuiasPgfnPort,
  ParcelamentoPgfn,
} from "@/modules/atendimento/application/ports/out/guias-pgfn.provider";
import type {
  GuiaEntregue,
  ParcelamentoDoCliente,
  ParcelamentosDoClientePort,
} from "@/modules/atendimento/application/ports/out/parcelamentos-do-cliente.provider";
import type { RelogioPort } from "@/modules/atendimento/application/ports/out/relogio.provider";
import { chaveDoParcelamento } from "@/modules/atendimento/domain/services/guia-guardada.service";
import type { AppError } from "@/shared/errors/app.error";
import { mesAnterior, mesAtual } from "@/shared/kernel/mes-atual";
import { ok, type Result } from "@/shared/kernel/result";

const SEM_PARCELAMENTO = "Não encontramos parcelamento vigente para a sua empresa.";
const TODOS_QUITADOS = "Todos os parcelamentos da sua empresa foram quitados.";

// `nova`: guia emitida agora, ainda sem envio nem registro. Sem ela a parcela já tem registro e o
// PDF do `caminho` guardado nele é reenviado (null: registro sem caminho, não há o que reenviar).
// `parcela` null: não há guia para entregar.
type Alvo = {
  parcelamento: ParcelamentoDoCliente;
  parcela: string | null;
  nova?: GuiaFiscal;
  caminho?: string | null;
};

type GuiaNova = { parcela: string; guia: GuiaFiscal };

// A guia do mês vence a do mês anterior.
function preferirDoMes(atual: GuiaNova | undefined, candidata: GuiaNova, mes: string): GuiaNova {
  return atual?.parcela === mes ? atual : candidata;
}

function escolherAlvo(
  parcelamento: ParcelamentoDoCliente,
  novas: Map<string, GuiaNova>,
  mes: string,
  anterior: string,
): Alvo {
  if (parcelamento.parcelasEnviadas.includes(mes)) return { parcelamento, parcela: mes };
  const nova = novas.get(parcelamento.id);
  if (nova) return { parcelamento, parcela: nova.parcela, nova: nova.guia };
  const guardada = parcelamento.parcelasEnviadas.includes(anterior);
  return { parcelamento, parcela: guardada ? anterior : null };
}

// A opção do parcelamento na URA segue a regra do job, mudando só o gatilho: para cada parcelamento
// comum em aberto, a parcela do mês ou, se o provedor ainda não a emite, a do mês anterior. Uma
// mensagem com PDF por parcelamento, identificada pelo código. Parcela com registro reenvia o PDF
// guardado, sem provedor e sem novo desconto; só a primeira entrega chama o provedor, registra o
// envio e desconta. Internos são ignorados e nunca mencionados. O banco decide "sem parcelamento" e
// "quitados" antes de qualquer chamada ao provedor.
// O parcelamento da PGFN (#186) entrega as guias confirmadas à mão ainda sem registro, até o mês
// corrente e da mais antiga para a mais nova, com o PDF do banco; sem nenhuma pendente, reenvia a
// última já entregue (o PDF do registro, sem novo registro nem desconto). Sem guia confirmada o contato recebe
// "ainda não disponível", sem alerta ao setor.
// ponytail: sem a reserva por Cliente do job; job e URA simultâneos podem duplicar o PDF, nunca o
// desconto (o registro é único por parcela). Reservar se virar problema.
export class EntregarParcelamentoNaUra implements EntregarNaUraPort {
  constructor(
    private readonly parcelamentos: ParcelamentosDoClientePort,
    private readonly guias: GuiasParcelamentoPort,
    private readonly publicadas: GuiaPublicadaPort,
    private readonly pgfn: GuiasPgfnPort,
    private readonly envio: EnvioMensagemPort,
    private readonly relogio: RelogioPort,
  ) {}

  async execute({ clienteId, telefone }: EntregarNaUraInput): Promise<Result<void, AppError>> {
    const emAberto = await this.parcelamentos.listarEmAberto(clienteId);
    if (!emAberto.ok) return emAberto;
    const emAbertoPgfn = await this.pgfn.listarEmAberto(clienteId);
    if (!emAbertoPgfn.ok) return emAbertoPgfn;
    // Interno nunca vai ao Cliente: some da resposta, como se não existisse.
    const comuns = emAberto.value.filter((p) => !p.interno);
    const comunsPgfn = emAbertoPgfn.value.filter((p) => !p.interno);
    if (comuns.length === 0 && comunsPgfn.length === 0) {
      return this.avisarSemParcelamento(clienteId, telefone);
    }

    const alvos =
      comuns.length === 0 ? [] : await this.definirAlvos(clienteId, emAberto.value, comuns);
    const falhas = await this.entregarTodos(clienteId, telefone, alvos);
    const pgfn = await this.entregarPgfn(clienteId, telefone, comunsPgfn);
    falhas.push(...pgfn.falhas);
    const textos = [
      falhas.length > 0 &&
        `Não conseguimos enviar a guia do parcelamento ${falhas.join(", ")}. Tente novamente em alguns minutos ou fale com o escritório.`,
      pgfn.indisponiveis.length > 0 &&
        `A guia do parcelamento ${pgfn.indisponiveis.join(", ")} ainda não está disponível. O escritório enviará assim que estiver.`,
    ];
    for (const texto of textos) {
      if (!texto) continue;
      const enviado = await this.envio.enviar({ telefone, texto });
      if (!enviado.ok) return enviado;
    }
    return ok(undefined);
  }

  // Um parcelamento PGFN por vez; para na primeira guia que não chegou ao contato, para não pular a
  // ordem. `indisponiveis`: sem guia confirmada para entregar nem reenviar.
  private async entregarPgfn(
    clienteId: string,
    telefone: string,
    parcelamentos: ParcelamentoPgfn[],
  ): Promise<{ falhas: string[]; indisponiveis: string[] }> {
    const mes = mesAtual(this.relogio.agora()).replace("-", "");
    const todas = guiasPgfnAEntregar(parcelamentos, mes);
    const falhas: string[] = [];
    const indisponiveis: string[] = [];
    for (const parcelamento of parcelamentos) {
      // Nunca mais guias do que parcelas restantes: o acordo quitaria antes do fim da lista.
      const guias = todas
        .filter((g) => g.parcelamento.id === parcelamento.id)
        .slice(0, parcelamento.parcelasRestantes);
      if (guias.length === 0) {
        // Reenvio: o PDF do registro da entrega, de qualquer competência (inclusive atrasada).
        const entregue = guiaPgfnAReenviar(parcelamento);
        if (!entregue) {
          indisponiveis.push(parcelamento.codigo);
        } else if (
          !(await this.entregar(clienteId, telefone, {
            parcelamento,
            parcela: entregue.competencia,
            caminho: entregue.caminho,
          }))
        ) {
          falhas.push(parcelamento.codigo);
        }
        continue;
      }
      for (const { competencia, caminho } of guias) {
        if (
          !(await this.entregarGuiaPgfn(clienteId, telefone, parcelamento, competencia, caminho))
        ) {
          falhas.push(parcelamento.codigo);
          break;
        }
      }
    }
    return { falhas, indisponiveis };
  }

  // `true` se o contato recebeu o PDF. O registro é único por parcela: o reenvio não desconta outra.
  private async entregarGuiaPgfn(
    clienteId: string,
    telefone: string,
    parcelamento: ParcelamentoPgfn,
    competencia: string,
    caminho: string,
  ): Promise<boolean> {
    const lida = await reservarELerGuiaPgfn(this.pgfn, clienteId, parcelamento.id, {
      competencia,
      caminho,
    });
    if (!lida.ok) return false;
    try {
      const guia = guiaPgfn(parcelamento.codigo, competencia, lida.value.pdf);
      return await this.entregarNova(clienteId, telefone, parcelamento, competencia, guia);
    } finally {
      // Registrada, a competência já trava sozinha; sem entrega, a guia volta a ser editável.
      await this.pgfn.liberar(parcelamento.id, competencia, lida.value.token);
    }
  }

  private async avisarSemParcelamento(
    clienteId: string,
    telefone: string,
  ): Promise<Result<void, AppError>> {
    const total = await this.parcelamentos.contarComuns(clienteId);
    if (!total.ok) return total;
    const texto = total.value === 0 ? SEM_PARCELAMENTO : TODOS_QUITADOS;
    return this.envio.enviar({ telefone, texto });
  }

  // Um parcelamento por vez, na ordem; devolve os códigos dos que não chegaram ao contato.
  private async entregarTodos(
    clienteId: string,
    telefone: string,
    alvos: Alvo[],
  ): Promise<string[]> {
    const entregues: boolean[] = [];
    for (const alvo of alvos) entregues.push(await this.entregar(clienteId, telefone, alvo));
    return alvos.filter((_, i) => !entregues[i]).map((alvo) => alvo.parcelamento.codigo);
  }

  private async definirAlvos(
    clienteId: string,
    emAberto: ParcelamentoDoCliente[],
    comuns: ParcelamentoDoCliente[],
  ): Promise<Alvo[]> {
    const agora = this.relogio.agora();
    const mes = mesAtual(agora).replace("-", "");
    const anterior = mesAnterior(agora);
    const entregues = await this.parcelamentos.guiasEntregues(clienteId);
    if (!entregues.ok) {
      console.error("Guias já entregues do Cliente indisponíveis para a URA.");
      return comuns.map((parcelamento) => ({ parcelamento, parcela: null }));
    }
    const novas = await this.buscarNovas(
      clienteId,
      emAberto,
      comuns,
      entregues.value,
      mes,
      anterior,
    );
    // Falha ao emitir não impede o reenvio do que já está registrado e guardado: só os parcelamentos
    // que dependiam de guia nova ficam sem alvo e entram na lista de falhas.
    if (!novas.ok) console.error("Guias novas do parcelamento indisponíveis para a URA.");
    return comuns.map((p) => {
      const alvo = escolherAlvo(p, novas.ok ? novas.value : new Map(), mes, anterior);
      if (alvo.nova || !alvo.parcela) return alvo;
      const entregue = entregues.value.find(
        (e) => e.parcelamentoId === p.id && e.parcela === alvo.parcela,
      );
      return { ...alvo, caminho: entregue?.caminho ?? null };
    });
  }

  // O provedor só é chamado se algum comum ainda não tem a parcela do mês registrada.
  private async buscarNovas(
    clienteId: string,
    emAberto: ParcelamentoDoCliente[],
    comuns: ParcelamentoDoCliente[],
    entregues: GuiaEntregue[],
    mes: string,
    anterior: string,
  ): Promise<Result<Map<string, GuiaNova>, AppError>> {
    const novas = new Map<string, GuiaNova>();
    if (comuns.every((p) => p.parcelasEnviadas.includes(mes))) return ok(novas);

    const jaRecebidas = comuns[0].parcelasEnviadas.filter((parcela) =>
      comuns.every((p) => p.parcelasEnviadas.includes(parcela)),
    );
    const buscadas = await this.guias.buscarGuiasParcelamento(clienteId, jaRecebidas);
    if (!buscadas.ok) return buscadas;
    // A atribuição vê todos os em aberto: a guia de um interno não cai num comum.
    const atribuidas = atribuirGuiasParcelamento(buscadas.value, emAberto, entregues);
    const doPeriodo = atribuidas.filter((a) => a.parcela === mes || a.parcela === anterior);
    for (const { parcelamento, guia, parcela } of doPeriodo) {
      novas.set(parcelamento.id, preferirDoMes(novas.get(parcelamento.id), { parcela, guia }, mes));
    }
    return ok(novas);
  }

  // `true` se o contato recebeu o PDF.
  private async entregar(
    clienteId: string,
    telefone: string,
    { parcelamento, parcela, nova, caminho }: Alvo,
  ): Promise<boolean> {
    if (!parcela) return false;
    const nomeArquivo = `parcelamento-${parcelamento.codigo}-${parcela}.pdf`;
    if (!nova) {
      // Reenvio: o PDF que o envio aceito guardou, sem escolher entre versões do período.
      if (!caminho) return false;
      const url = await this.publicadas.reencontrar(clienteId, caminho);
      if (!url.ok) return false;
      const reenviada = await this.envio.enviarDocumento({ telefone, nomeArquivo, url: url.value });
      return reenviada.ok;
    }

    return this.entregarNova(clienteId, telefone, parcelamento, parcela, nova);
  }

  // Primeira entrega da guia: publica o PDF, envia e registra (desconta uma parcela). O PDF publicado
  // fica no Storage mesmo se a entrega for recusada: só o registro do envio aceito o aponta (ver o
  // gateway). `true` se o contato recebeu.
  private async entregarNova(
    clienteId: string,
    telefone: string,
    parcelamento: { id: string; codigo: string },
    parcela: string,
    nova: GuiaFiscal,
  ): Promise<boolean> {
    const nomeArquivo = `parcelamento-${parcelamento.codigo}-${parcela}.pdf`;
    const publicada = await this.publicadas.publicar(
      clienteId,
      nova,
      chaveDoParcelamento(parcelamento.id, parcela),
    );
    if (!publicada.ok) return false;
    const enviada = await this.envio.enviarDocumento({
      telefone,
      nomeArquivo,
      url: publicada.value.url,
    });
    if (!enviada.ok) return false;

    // A guia já saiu: se o registro falha, o contato recebeu e o rastro fica no log.
    const registro = await this.parcelamentos.registrarEnvio(
      parcelamento.id,
      parcela,
      identidadeDaGuia(nova),
      publicada.value.caminho,
    );
    if (!registro.ok || registro.value === "nao_elegivel") {
      console.error("Guia de parcelamento entregue pela URA, mas o envio não foi registrado.");
    }
    return true;
  }
}
