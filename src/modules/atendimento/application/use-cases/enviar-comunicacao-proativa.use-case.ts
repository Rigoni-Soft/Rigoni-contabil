import {
  janelaAberta,
  montarMensagemLivre,
  montarTemplate,
  type ComunicacaoProativa,
} from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

export type EnviarComunicacaoProativaInput = {
  telefone: string;
  comunicacao: ComunicacaoProativa;
  ultimaMensagemDoContatoEm: Date | null;
  agora: Date;
};

// Janela de 24h aberta: formato próprio do sistema (grátis). Fechada: template aprovado.
export class EnviarComunicacaoProativa {
  constructor(private readonly envio: EnvioMensagemPort) {}

  async execute(entrada: EnviarComunicacaoProativaInput): Promise<Result<void, AppError>> {
    const { telefone, comunicacao } = entrada;
    if (!janelaAberta(entrada.ultimaMensagemDoContatoEm, entrada.agora)) {
      return this.envio.enviarTemplate(montarTemplate(comunicacao, telefone));
    }
    const { texto, documento } = montarMensagemLivre(comunicacao, telefone);
    const enviada = await this.envio.enviar({ telefone, texto });
    if (!enviada.ok) return enviada;
    return documento ? this.envio.enviarDocumento(documento) : ok(undefined);
  }
}
