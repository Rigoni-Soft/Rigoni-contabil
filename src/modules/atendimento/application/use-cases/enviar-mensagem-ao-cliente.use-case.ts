import type { EnviarMensagemAoClientePort } from "@/modules/atendimento/application/ports/in/enviar-mensagem-ao-cliente.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/atendimento/application/ports/out/sessao.provider";
import { podeTransferir } from "@/modules/atendimento/domain/services/transferencia.service";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { contarCaracteres } from "@/shared/kernel/texto";

const ACAO = "atendimento.enviar_mensagem";
const TEXTO_TAMANHO_MAXIMO = 4096; // limite de uma mensagem de texto do WhatsApp

// Mesma regra de quem pode agir que a Transferência. A intenção é gravada `pendente` e só vira
// `entregue` com o aceite do adapter; falhou ou ficou incerto, a linha continua (`falha`/`pendente`)
// e não conta como resposta na inatividade.
export class EnviarMensagemAoCliente implements EnviarMensagemAoClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly envio: EnvioMensagemPort,
    private readonly auditoria: AuditoriaPort,
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
    if (contarCaracteres(mensagem) > TEXTO_TAMANHO_MAXIMO) {
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

    // A intenção entra no histórico (sob o lock do Atendimento, com a autoridade relida do perfil)
    // ANTES de sair: o fechamento que vence a corrida não deixa uma resposta enviada a um
    // Atendimento encerrado. O resultado fecha a linha; ela nunca é apagada.
    const registrada = await this.repositorio.registrarMensagemDoFuncionario(
      atendimentoId,
      ator,
      mensagem,
    );
    if (!registrada.ok) return registrada;
    if (registrada.value.status === "encerrada") {
      return err(new NotFoundError("O Atendimento já foi encerrado."));
    }
    if (registrada.value.status === "sem_autoridade") {
      return err(new ForbiddenError("Você não pode responder neste Atendimento."));
    }

    const enviada = await this.enviar(atendimento.telefone, mensagem, registrada.value.id);
    // Falha ao fechar a linha a deixa `pendente`: segue sem contar como resposta e a conversa a
    // mostra como não confirmada. O envio aceito não vira erro (reenviar duplicaria).
    await this.repositorio.finalizarEntregaDoFuncionario(registrada.value.id, enviada.ok);
    if (!enviada.ok) {
      await this.auditar(ator, atendimentoId, "falha");
      return enviada;
    }
    // O texto não vai para a trilha.
    await this.auditar(ator, atendimentoId, "sucesso");
    return ok(undefined);
  }

  private auditar(ator: AtorSessaoDto, atendimentoId: string, resultado: "sucesso" | "falha") {
    return this.auditoria.registrar({
      ator: ator.id,
      setor: ator.setor,
      acao: ACAO,
      alvo: atendimentoId,
      resultado,
    });
  }

  private async enviar(
    telefone: string,
    texto: string,
    chaveIdempotencia: string,
  ): Promise<Result<void, AppError>> {
    try {
      return await this.envio.enviar({ telefone, texto, chaveIdempotencia });
    } catch {
      return err(new ServicoExternoError("Falha ao enviar a mensagem."));
    }
  }
}
