import type { ReagirAMensagemPort } from "@/modules/atendimento/application/ports/in/reagir-a-mensagem.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/atendimento/application/ports/out/sessao.provider";
import { podeTransferir } from "@/modules/atendimento/domain/services/transferencia.service";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { emojiValido } from "@/shared/kernel/texto";

const ACAO = "atendimento.reagir_mensagem";

// Mesma regra de quem pode agir que o envio de mensagem. A reação só é registrada depois de
// entregue ao cliente (o painel mostra o que ele de fato recebeu).
export class ReagirAMensagem implements ReagirAMensagemPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly envio: EnvioMensagemPort,
    private readonly auditoria: AuditoriaPort,
  ) {}

  async execute({
    atendimentoId,
    mensagemId,
    emoji,
  }: {
    atendimentoId: string;
    mensagemId: string;
    emoji: string;
  }): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para reagir à mensagem."));

    const escolhido = emoji.trim();
    if (!emojiValido(escolhido)) {
      return err(new ValidationError("Escolha um emoji.", { emoji: ["Inválido"] }));
    }

    const encontrado = await this.repositorio.buscarEmAndamento(atendimentoId);
    if (!encontrado.ok) return encontrado;
    const atendimento = encontrado.value;
    if (!atendimento) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeTransferir(ator, atendimento)) {
      return err(new ForbiddenError("Você não pode reagir neste Atendimento."));
    }

    const lida = await this.repositorio.mensagemParaReacao(atendimentoId, mensagemId);
    if (!lida.ok) return lida;
    const mensagem = lida.value;
    if (!mensagem) return err(new NotFoundError("Mensagem não encontrada."));
    if (mensagem.autor !== "contato" || !mensagem.idExterno) {
      return err(new ValidationError("Só dá para reagir a uma mensagem do cliente."));
    }

    const remover = mensagem.reacao === escolhido;
    const enviada = await this.reagir(
      atendimento.telefone,
      mensagem.idExterno,
      remover ? "" : escolhido,
    );
    if (!enviada.ok) {
      await this.auditar(ator, atendimentoId, "falha");
      return enviada;
    }

    // ponytail: o toggle lê e grava sem trava; dois cliques simultâneos no mesmo balão podem
    // divergir provedor e banco. Aceito (um Funcionário por Atendimento); trava otimista se pesar.
    const registrada = await this.repositorio.registrarReacao(
      atendimentoId,
      mensagemId,
      remover ? null : escolhido,
    );
    // Já entregue: o registro falhar não desfaz a reação enviada.
    await this.auditar(ator, atendimentoId, "sucesso");
    if (!registrada.ok) {
      return err(
        new EstadoInconsistenteError(
          "Reação enviada, mas a conversa não a registrou.",
          atendimentoId,
        ),
      );
    }
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

  private async reagir(
    telefone: string,
    idExterno: string,
    emoji: string,
  ): Promise<Result<void, AppError>> {
    try {
      return await this.envio.reagir({ telefone, idExterno, emoji });
    } catch {
      return err(new ServicoExternoError("Falha ao enviar a reação."));
    }
  }
}
