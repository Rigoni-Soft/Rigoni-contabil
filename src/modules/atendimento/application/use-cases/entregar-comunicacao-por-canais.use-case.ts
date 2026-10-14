import {
  comTentativas,
  ESPERA_MS,
  TENTATIVAS,
} from "@/modules/atendimento/application/com-tentativas";
import {
  montarTextoLivre,
  type ComunicacaoProativa,
} from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type { ClienteParaLembrete } from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";
import type { EnvioEmailPort } from "@/modules/atendimento/application/ports/out/envio-email.provider";
import type { RodadaLembretes } from "@/modules/atendimento/application/rodada-lembretes";
import type { EnviarComunicacaoProativa } from "@/modules/atendimento/application/use-cases/enviar-comunicacao-proativa.use-case";
import { formaEnvioUsaEmail, formaEnvioUsaWhatsapp } from "@/shared/kernel/forma-envio";

// Entrega a comunicação pelos canais da forma de envio do Cliente. `true` se ao menos um canal
// entregou; o canal que não entrega vira alerta do setor e não derruba o outro.
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
    const porWhatsapp = formaEnvioUsaWhatsapp(cliente.formaEnvio)
      ? await this.porWhatsapp(cliente, comunicacao, agora, rodada)
      : false;
    const porEmail = formaEnvioUsaEmail(cliente.formaEnvio)
      ? await this.porEmail(cliente, comunicacao, rodada)
      : false;
    return porWhatsapp || porEmail;
  }

  private async porWhatsapp(
    cliente: ClienteParaLembrete,
    comunicacao: ComunicacaoProativa,
    agora: Date,
    rodada: RodadaLembretes,
  ): Promise<boolean> {
    if (!cliente.contato) {
      await rodada.alertar(
        cliente,
        "contato_ausente",
        `${cliente.empresa} não tem contato padrão.`,
      );
      return false;
    }
    const enviado = await this.proativa.execute({
      telefone: cliente.contato.telefone,
      comunicacao,
      ultimaMensagemDoContatoEm: cliente.ultimaMensagemDoContatoEm,
      agora,
    });
    if (enviado.ok) return true;
    await rodada.falhou(cliente, `WhatsApp de ${cliente.empresa}: ${enviado.error.message}`);
    return false;
  }

  private async porEmail(
    cliente: ClienteParaLembrete,
    comunicacao: ComunicacaoProativa,
    rodada: RodadaLembretes,
  ): Promise<boolean> {
    const destinatario = cliente.email;
    if (!destinatario) {
      await rodada.alertar(cliente, "contato_ausente", `${cliente.empresa} não tem e-mail.`);
      return false;
    }
    const anexo = "guia" in comunicacao ? comunicacao.guia : undefined;
    const tema = anexo ? "Guia do DAS" : "Documentos fiscais pendentes";
    const enviado = await comTentativas(
      () =>
        this.email.enviar({
          para: destinatario,
          assunto: `${tema} — ${cliente.empresa}`,
          texto: montarTextoLivre(comunicacao),
          anexo,
        }),
      TENTATIVAS,
      this.esperaEntreTentativasMs,
    );
    if (enviado.ok) return true;
    await rodada.falhou(cliente, `E-mail de ${cliente.empresa}: ${enviado.error.message}`);
    return false;
  }
}
