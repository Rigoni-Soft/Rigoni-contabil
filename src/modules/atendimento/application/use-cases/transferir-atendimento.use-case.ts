import type { AvisarClientePort } from "@/modules/atendimento/application/ports/in/avisar-cliente.provider";
import type {
  TransferenciaConcluida,
  TransferirAtendimentoInput,
  TransferirAtendimentoPort,
} from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type {
  AtendimentoEmAndamento,
  AtendimentoRepositoryPort,
  NovaTransferencia,
  ResultadoTransferencia,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/atendimento/application/ports/out/sessao.provider";
import { AVISO_AGUARDE } from "@/modules/atendimento/domain/services/aviso-fila.service";
import {
  atendidoPeloSimplesNacional,
  podeTransferir,
} from "@/modules/atendimento/domain/services/transferencia.service";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { SETOR_LABEL, type SetorSlug } from "@/shared/kernel/setores";

// Espera dirigida (`funcionarioId`) ou do Setor (null).
type DestinoFixo = { funcionarioId: string | null };

const RESUMO_TAMANHO_MAXIMO = 1000; // repetido na CHECK de `transferencias.resumo`

type Transferido = Extract<ResultadoTransferencia, { status: "transferido" }>;

// O Atendimento vai para a espera do Setor de destino; no Setor Simples Nacional, dirigido ao
// Responsável do Cliente (ou ao Líder). Ninguém é escolhido pelo sistema: quem atende o assume.
export class TransferirAtendimento implements TransferirAtendimentoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly auditoria: AuditoriaPort,
    private readonly avisar: AvisarClientePort,
  ) {}

  async execute(
    input: TransferirAtendimentoInput,
  ): Promise<Result<TransferenciaConcluida, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para transferir o Atendimento."));

    const atendimento = await this.validar(ator, input);
    if (!atendimento.ok) return atendimento;
    const fixo = await this.destinoFixo(atendimento.value, input.setorDestino);
    if (!fixo.ok) return fixo;
    const resumo = input.resumo.trim();

    const gravada = await this.gravar(
      {
        atendimentoId: input.atendimentoId,
        origemFuncionarioId: atendimento.value.funcionarioId,
        setorOrigem: atendimento.value.setor,
        setorDestino: input.setorDestino,
        resumo,
        ator: { id: ator.id, setor: ator.setor },
      },
      fixo.value,
    );
    if (!gravada.ok) {
      await this.auditarFalha(ator, input.atendimentoId);
      return gravada;
    }

    // Transferido: falhar daqui em diante não desfaz nada; o erro diz que o Atendimento já está
    // com o destino e o cliente não foi avisado.
    const { destinatarioNome, origemNome, contato } = gravada.value;
    const aviso = await this.avisar.execute({
      telefone: atendimento.value.telefone,
      chave: atendimento.value.chave,
      texto: AVISO_AGUARDE,
    });
    if (!aviso.ok) {
      await this.auditarFalha(ator, input.atendimentoId);
      return err(
        new EstadoInconsistenteError(
          "Atendimento transferido, mas o aviso ao cliente falhou.",
          input.atendimentoId,
        ),
      );
    }
    return ok({
      destinatarioNome,
      contato,
      origemSetor: atendimento.value.setor,
      origemNome,
      resumo,
    });
  }

  private async validar(
    ator: AtorSessaoDto,
    { atendimentoId, setorDestino, resumo }: TransferirAtendimentoInput,
  ): Promise<Result<AtendimentoEmAndamento, AppError>> {
    const encontrado = await this.repositorio.buscarEmAndamento(atendimentoId);
    if (!encontrado.ok) return encontrado;
    const atendimento = encontrado.value;
    if (!atendimento) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeTransferir(ator, atendimento)) {
      return err(new ForbiddenError("Você não pode transferir este Atendimento."));
    }
    if (atendimento.emAvisoDeInatividade) {
      return err(
        new ValidationError(
          "Este Atendimento está em aviso de encerramento por inatividade e não pode ser transferido.",
        ),
      );
    }
    if (setorDestino === atendimento.setor) {
      return err(
        new ValidationError("Escolha outro Setor.", { setorDestino: ["Setor de origem"] }),
      );
    }
    if (!resumo.trim()) {
      return err(new ValidationError("Informe o resumo do assunto.", { resumo: ["Obrigatório"] }));
    }
    if (resumo.trim().length > RESUMO_TAMANHO_MAXIMO) {
      return err(
        new ValidationError(`O resumo aceita até ${RESUMO_TAMANHO_MAXIMO} caracteres.`, {
          resumo: ["Muito longo"],
        }),
      );
    }
    return ok(atendimento);
  }

  // Setor Simples Nacional: só Cliente do Simples Nacional/MEI; fica dirigido ao Responsável do
  // Cliente, ou ao Líder se não houver. Outros Setores: null.
  private async destinoFixo(
    atendimento: AtendimentoEmAndamento,
    setorDestino: SetorSlug,
  ): Promise<Result<DestinoFixo | null, AppError>> {
    if (setorDestino !== "simples_nacional") return ok(null);
    const roteamento = atendimento.clienteId
      ? await this.repositorio.roteamentoDoCliente(atendimento.clienteId)
      : ok(null);
    if (!roteamento.ok) return roteamento;
    if (!roteamento.value || !atendidoPeloSimplesNacional(roteamento.value.regime)) {
      return err(
        new ValidationError("Só Cliente do Simples Nacional ou MEI vai para o Simples Nacional.", {
          setorDestino: ["Cliente fora do Simples Nacional/MEI"],
        }),
      );
    }
    if (roteamento.value.responsavelId)
      return ok({ funcionarioId: roteamento.value.responsavelId });
    const lider = await this.repositorio.liderDoSetor(setorDestino);
    return lider.ok ? ok({ funcionarioId: lider.value }) : lider;
  }

  private async gravar(
    dados: Omit<NovaTransferencia, "dirigidoA">,
    fixo: DestinoFixo | null,
  ): Promise<Result<Transferido, AppError>> {
    return this.exigirTransferido(
      await this.repositorio.transferir({ ...dados, dirigidoA: fixo?.funcionarioId ?? null }),
    );
  }

  private exigirTransferido(
    resultado: Result<ResultadoTransferencia, AppError>,
  ): Result<Transferido, AppError> {
    if (!resultado.ok) return resultado;
    if (resultado.value.status === "transferido") return ok(resultado.value);
    if (resultado.value.status === "inexistente") {
      return err(
        new NotFoundError("O Atendimento mudou ou foi encerrado. Atualize e tente novamente."),
      );
    }
    return err(new ServicoExternoError("O destinatário do Setor não está mais disponível."));
  }

  private async auditarFalha(ator: AtorSessaoDto, atendimentoId: string): Promise<void> {
    await this.auditoria.registrar({
      ator: ator.id,
      setor: ator.setor,
      acao: "atendimento.transferir",
      alvo: atendimentoId,
      resultado: "falha",
    });
  }
}
