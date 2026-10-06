import type { AvisarClientePort } from "@/modules/atendimento/application/ports/in/avisar-cliente.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class AvisarCliente implements AvisarClientePort {
  constructor(
    private readonly envio: EnvioMensagemPort,
    private readonly repositorio: AtendimentoRepositoryPort,
  ) {}

  async execute(input: {
    telefone: string;
    chave: string;
    texto: string;
  }): Promise<Result<void, AppError>> {
    // Só vira Mensagem do Atendimento o que o cliente de fato recebeu.
    const enviada = await this.enviar(input.telefone, input.texto);
    if (!enviada.ok) return enviada;
    const registrada = await this.repositorio.anexarMensagem(input.chave, {
      autor: "ura",
      texto: input.texto,
    });
    return registrada.ok ? ok(undefined) : registrada;
  }

  private async enviar(telefone: string, texto: string): Promise<Result<void, AppError>> {
    try {
      return await this.envio.enviar({ telefone, texto });
    } catch {
      return err(new ServicoExternoError("Falha ao enviar a mensagem."));
    }
  }
}
