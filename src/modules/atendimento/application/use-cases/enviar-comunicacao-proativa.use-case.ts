import {
  janelaAberta,
  montarMensagemLivre,
  montarTemplate,
} from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type {
  EnviarComunicacaoProativaInput,
  EnviarComunicacaoProativaPort,
} from "@/modules/atendimento/application/ports/in/enviar-comunicacao-proativa.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { AppError } from "@/shared/errors/app.error";
import { comTentativas } from "@/shared/kernel/com-tentativas";
import { ok, type Result } from "@/shared/kernel/result";

// Janela de 24h aberta: formato próprio do sistema (grátis). Fechada: template aprovado.
// Cada envio repete sozinho em falha transitória (`tentativas`): na janela aberta o texto que já
// chegou não sai de novo quando só o documento falhou.
export class EnviarComunicacaoProativa implements EnviarComunicacaoProativaPort {
  constructor(
    private readonly envio: EnvioMensagemPort,
    private readonly tentativas = 1,
    private readonly esperaEntreTentativasMs = 0,
  ) {}

  async execute(entrada: EnviarComunicacaoProativaInput): Promise<Result<void, AppError>> {
    const { telefone, comunicacao } = entrada;
    if (!janelaAberta(entrada.ultimaMensagemDoContatoEm, entrada.agora)) {
      return this.tentar(() => this.envio.enviarTemplate(montarTemplate(comunicacao, telefone)));
    }
    const { texto, documento } = montarMensagemLivre(comunicacao, telefone);
    const enviada = await this.tentar(() => this.envio.enviar({ telefone, texto }));
    if (!enviada.ok) return enviada;
    return documento ? this.tentar(() => this.envio.enviarDocumento(documento)) : ok(undefined);
  }

  private tentar(envio: () => Promise<Result<void, AppError>>): Promise<Result<void, AppError>> {
    return comTentativas(envio, this.tentativas, this.esperaEntreTentativasMs);
  }
}
