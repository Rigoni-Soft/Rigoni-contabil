import type { PromoverDaFilaPort } from "@/modules/atendimento/application/ports/in/promover-da-fila.provider";
import type {
  AtendimentoAssumido,
  AtendimentoRepositoryPort,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// Sempre o mais antigo da Fila (o repositório decide), nunca a ordem do Balanceamento; o
// Atendimento assumido ainda conta pro Balanceamento mensal de quem assumiu.
export class PromoverDaFila implements PromoverDaFilaPort {
  constructor(
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly envio: EnvioMensagemPort,
  ) {}

  async execute(input: {
    funcionarioId: string;
    setor: SetorSlug;
  }): Promise<Result<{ atendimentoId: string } | null, AppError>> {
    const assumido = await this.repositorio.liberarFuncionario(input.funcionarioId, input.setor);
    if (!assumido.ok) return assumido;
    if (!assumido.value) return ok(null);

    // Assumido: falhar daqui em diante não desfaz nada; o erro diz que o cliente não foi avisado.
    const avisado = await this.avisar(assumido.value);
    if (!avisado.ok) {
      return err(
        new EstadoInconsistenteError(
          "Atendimento assumido da Fila, mas o aviso ao cliente falhou.",
          assumido.value.id,
        ),
      );
    }
    return ok({ atendimentoId: assumido.value.id });
  }

  private async avisar(assumido: AtendimentoAssumido): Promise<Result<void, AppError>> {
    const texto = assumido.funcionarioNome
      ? `Chegou a sua vez! ${assumido.funcionarioNome} vai te atender agora.`
      : "Chegou a sua vez! Um atendente vai te atender agora.";
    // Só vira Mensagem do Atendimento o que o cliente de fato recebeu.
    try {
      const enviada = await this.envio.enviar({ telefone: assumido.telefone, texto });
      if (!enviada.ok) return enviada;
    } catch {
      return err(new EstadoInconsistenteError("Falha ao enviar a mensagem.", assumido.id));
    }
    const registrada = await this.repositorio.anexarMensagem(assumido.chave, {
      autor: "ura",
      texto,
    });
    return registrada.ok ? ok(undefined) : registrada;
  }
}
