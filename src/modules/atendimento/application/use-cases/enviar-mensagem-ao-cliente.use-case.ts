import type { EnviarMensagemAoClientePort } from "@/modules/atendimento/application/ports/in/enviar-mensagem-ao-cliente.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { podeTransferir } from "@/modules/atendimento/domain/services/transferencia.service";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const TEXTO_TAMANHO_MAXIMO = 4096; // limite de uma mensagem de texto do WhatsApp

// Mesma regra de quem pode agir que a Transferência. A Mensagem só entra no Atendimento depois de
// entregue ao cliente (só vira histórico o que ele de fato recebeu).
export class EnviarMensagemAoCliente implements EnviarMensagemAoClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly envio: EnvioMensagemPort,
  ) {}

  async execute({
    atendimentoId,
    texto,
  }: {
    atendimentoId: string;
    texto: string;
  }): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para responder o cliente."));

    const mensagem = texto.trim();
    if (!mensagem)
      return err(new ValidationError("Escreva a mensagem.", { texto: ["Obrigatório"] }));
    if (mensagem.length > TEXTO_TAMANHO_MAXIMO) {
      return err(
        new ValidationError(`A mensagem aceita até ${TEXTO_TAMANHO_MAXIMO} caracteres.`, {
          texto: ["Muito longa"],
        }),
      );
    }

    const encontrado = await this.repositorio.buscarEmAndamento(atendimentoId);
    if (!encontrado.ok) return encontrado;
    const atendimento = encontrado.value;
    if (!atendimento) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeTransferir(ator, atendimento)) {
      return err(new ForbiddenError("Você não pode responder neste Atendimento."));
    }

    const enviada = await this.enviar(atendimento.telefone, mensagem);
    if (!enviada.ok) return enviada;

    const registrada = await this.repositorio.registrarMensagemDoFuncionario(
      atendimentoId,
      ator.id,
      mensagem,
    );
    if (!registrada.ok) {
      return err(
        new EstadoInconsistenteError(
          "Mensagem enviada, mas a conversa não a registrou.",
          atendimentoId,
        ),
      );
    }
    return ok(undefined);
  }

  private async enviar(telefone: string, texto: string): Promise<Result<void, AppError>> {
    try {
      return await this.envio.enviar({ telefone, texto });
    } catch {
      return err(new ServicoExternoError("Falha ao enviar a mensagem."));
    }
  }
}
