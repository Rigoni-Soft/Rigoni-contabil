import {
  guiaDe,
  montarAssuntoEmail,
  montarTextoLivre,
} from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type {
  EntregarComunicacaoInput,
  EntregarComunicacaoPorCanaisPort,
} from "@/modules/atendimento/application/ports/in/entregar-comunicacao-por-canais.provider";
import type { EnviarComunicacaoProativaPort } from "@/modules/atendimento/application/ports/in/enviar-comunicacao-proativa.provider";
import type { EnvioEmailPort } from "@/modules/atendimento/application/ports/out/envio-email.provider";
import { comTentativas, ESPERA_MS, TENTATIVAS } from "@/shared/kernel/com-tentativas";
import { formaEnvioUsaEmail, formaEnvioUsaWhatsapp } from "@/shared/kernel/forma-envio";

type ResultadoDoCanal = "entregue" | "falhou" | "indisponivel";

// Entrega a comunicação pelos canais da forma de envio do Cliente. O canal que não entrega vira
// alerta do setor sem derrubar o outro; entregar por um canal só (forma de envio com os dois, na
// guia) abre também o alerta `entrega_parcial`, que o job não resolve sozinho.
export class EntregarComunicacaoPorCanais implements EntregarComunicacaoPorCanaisPort {
  constructor(
    private readonly proativa: EnviarComunicacaoProativaPort,
    private readonly email: EnvioEmailPort,
    private readonly esperaEntreTentativasMs = ESPERA_MS,
  ) {}

  async execute(entrada: EntregarComunicacaoInput): Promise<boolean> {
    const { cliente, comunicacao, rodada } = entrada;
    const canais: ResultadoDoCanal[] = [];
    if (formaEnvioUsaWhatsapp(cliente.formaEnvio)) canais.push(await this.porWhatsapp(entrada));
    if (formaEnvioUsaEmail(cliente.formaEnvio)) canais.push(await this.porEmail(entrada));

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

  private async porWhatsapp(entrada: EntregarComunicacaoInput): Promise<ResultadoDoCanal> {
    const { cliente, comunicacao, agora, rodada } = entrada;
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

  private async porEmail(entrada: EntregarComunicacaoInput): Promise<ResultadoDoCanal> {
    const { cliente, comunicacao, rodada } = entrada;
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
