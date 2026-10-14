import {
  comTentativas,
  ESPERA_MS,
  TENTATIVAS,
} from "@/modules/atendimento/application/com-tentativas";
import {
  guiaDe,
  montarAssuntoEmail,
  montarTextoLivre,
  type ComunicacaoProativa,
} from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type { ClienteParaLembrete } from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";
import type { EnvioEmailPort } from "@/modules/atendimento/application/ports/out/envio-email.provider";
import type { RodadaLembretes } from "@/modules/atendimento/application/rodada-lembretes";
import type { EnviarComunicacaoProativa } from "@/modules/atendimento/application/use-cases/enviar-comunicacao-proativa.use-case";
import { formaEnvioUsaEmail, formaEnvioUsaWhatsapp } from "@/shared/kernel/forma-envio";

type ResultadoDoCanal = "entregue" | "falhou" | "indisponivel";

// Entrega a comunicação pelos canais da forma de envio do Cliente. `true` se ao menos um canal
// entregou. O canal que não entrega vira alerta do setor sem derrubar o outro; entregar por um
// canal só (forma de envio com os dois, na guia) abre também o alerta `entrega_parcial`, que o
// job não resolve sozinho.
export class EntregarComunicacaoPorCanais {
  constructor(
    private readonly proativa: EnviarComunicacaoProativa,
    private readonly email: EnvioEmailPort,
    private readonly esperaEntreTentativasMs = ESPERA_MS,
  ) {}

  async execute(
    cliente: ClienteParaLembrete,
    comunicacao: ComunicacaoProativa,
    agora: Date,
    rodada: RodadaLembretes,
  ): Promise<boolean> {
    const canais: ResultadoDoCanal[] = [];
    if (formaEnvioUsaWhatsapp(cliente.formaEnvio)) {
      canais.push(await this.porWhatsapp(cliente, comunicacao, agora, rodada));
    }
    if (formaEnvioUsaEmail(cliente.formaEnvio)) {
      canais.push(await this.porEmail(cliente, comunicacao, rodada));
    }
    const entregues = canais.filter((canal) => canal === "entregue").length;
    // Só a guia gera pendência: o lembrete é recorrente e volta a sair na próxima rodada.
    if (guiaDe(comunicacao) && entregues > 0 && entregues < canais.length) {
      await rodada.alertar(
        cliente,
        "entrega_parcial",
        `${cliente.empresa}: entregue por apenas um canal; reenviar pelo outro.`,
      );
    }
    return entregues > 0;
  }

  private async porWhatsapp(
    cliente: ClienteParaLembrete,
    comunicacao: ComunicacaoProativa,
    agora: Date,
    rodada: RodadaLembretes,
  ): Promise<ResultadoDoCanal> {
    if (!cliente.contato) {
      await rodada.alertar(
        cliente,
        "contato_ausente",
        `${cliente.empresa} não tem contato padrão.`,
      );
      return "indisponivel";
    }
    const enviado = await this.proativa.execute({
      telefone: cliente.contato.telefone,
      comunicacao,
      ultimaMensagemDoContatoEm: cliente.ultimaMensagemDoContatoEm,
      agora,
    });
    if (enviado.ok) return "entregue";
    await rodada.falhou(cliente, `WhatsApp de ${cliente.empresa}: ${enviado.error.message}`);
    return "falhou";
  }

  private async porEmail(
    cliente: ClienteParaLembrete,
    comunicacao: ComunicacaoProativa,
    rodada: RodadaLembretes,
  ): Promise<ResultadoDoCanal> {
    const destinatario = cliente.email;
    if (!destinatario) {
      await rodada.alertar(cliente, "contato_ausente", `${cliente.empresa} não tem e-mail.`);
      return "indisponivel";
    }
    const enviado = await comTentativas(
      () =>
        this.email.enviar({
          para: destinatario,
          assunto: `${montarAssuntoEmail(comunicacao)} — ${cliente.empresa}`,
          texto: montarTextoLivre(comunicacao),
          anexo: guiaDe(comunicacao),
        }),
      TENTATIVAS,
      this.esperaEntreTentativasMs,
    );
    if (enviado.ok) return "entregue";
    await rodada.falhou(cliente, `E-mail de ${cliente.empresa}: ${enviado.error.message}`);
    return "falhou";
  }
}
