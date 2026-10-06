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
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/atendimento/application/ports/out/sessao.provider";
import {
  menosCarregado,
  TENTATIVAS_DE_ATRIBUICAO,
} from "@/modules/atendimento/domain/services/balanceamento.service";
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

// Destino que não passa pelo Balanceamento (`funcionarioId` null = fila do Setor).
type DestinoFixo = { funcionarioId: string | null };

const RESUMO_TAMANHO_MAXIMO = 1000; // repetido na CHECK de `transferencias.resumo`

type Transferido = Extract<ResultadoTransferencia, { status: "transferido" }>;

function avisoAoCliente(setor: SetorSlug, atendente: string | null, naFila: boolean): string {
  if (naFila) {
    return `Você está na fila de atendimento de ${atendente} no setor ${SETOR_LABEL[setor]}. Aguarde, por favor.`;
  }
  if (!atendente) return `Você está na fila do setor ${SETOR_LABEL[setor]}. Aguarde, por favor.`;
  return `Estamos transferindo você para o setor ${SETOR_LABEL[setor]}, com ${atendente}. Aguarde um instante, por favor.`;
}

// Setores que recebem já são só os cliente-facing (SETORES exclui Patriki, Expedição e T.I.),
// então o tipo do destino basta. O Funcionário de destino sai do Balanceamento mensal; sem
// ninguém livre o Atendimento fica sem atribuição (a Fila é do #46).
export class TransferirAtendimento implements TransferirAtendimentoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly envio: EnvioMensagemPort,
    private readonly auditoria: AuditoriaPort,
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
    const { destinatarioNome, naFila, origemNome, contato } = gravada.value;
    const aviso = await this.avisarCliente(
      atendimento.value,
      avisoAoCliente(input.setorDestino, destinatarioNome, naFila),
    );
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
      naFila,
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

  // Setor Simples Nacional: só Cliente do Simples Nacional/MEI; vai direto ao Responsável do
  // Cliente, ou ao Líder se não houver, ignorando o Balanceamento. Outros Setores: null.
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

  // Destino fixo ocupado: o Atendimento entra na fila dele (o repositório faz). Sem destino fixo,
  // o repositório recusa ("conflito") se outro Atendimento ocupou o escolhido entre a listagem e a
  // gravação; relista e escolhe de novo. Esgotadas as tentativas, transfere sem atribuição.
  private async gravar(
    dados: Omit<NovaTransferencia, "funcionarioDestinoId" | "enfileirarSeOcupado">,
    fixo: DestinoFixo | null,
  ): Promise<Result<Transferido, AppError>> {
    if (fixo) {
      return this.exigirTransferido(
        await this.repositorio.transferir({
          ...dados,
          funcionarioDestinoId: fixo.funcionarioId,
          enfileirarSeOcupado: true,
        }),
      );
    }
    for (let tentativa = 0; tentativa < TENTATIVAS_DE_ATRIBUICAO; tentativa++) {
      const escolhido = await this.escolherDestino(dados.setorDestino);
      if (!escolhido.ok) return escolhido;
      const resultado = await this.repositorio.transferir({
        ...dados,
        funcionarioDestinoId: escolhido.value,
        enfileirarSeOcupado: false,
      });
      if (!resultado.ok || resultado.value.status !== "conflito") {
        return this.exigirTransferido(resultado);
      }
    }
    return this.exigirTransferido(
      await this.repositorio.transferir({
        ...dados,
        funcionarioDestinoId: null,
        enfileirarSeOcupado: false,
      }),
    );
  }

  private async escolherDestino(setor: SetorSlug): Promise<Result<string | null, AppError>> {
    const funcionarios = await this.repositorio.funcionariosDoSetor(setor);
    if (!funcionarios.ok) return funcionarios;
    return ok(menosCarregado(funcionarios.value)?.id ?? null);
  }

  // "conflito" sem Funcionário não existe: quebra o contrato do repositório.
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
    return err(new ServicoExternoError("Não foi possível escolher o Funcionário de destino."));
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

  private async avisarCliente(
    atendimento: AtendimentoEmAndamento,
    texto: string,
  ): Promise<Result<void, AppError>> {
    // Só vira Mensagem do Atendimento o que o cliente de fato recebeu.
    const enviada = await this.enviarAviso(atendimento.telefone, texto);
    if (!enviada.ok) return enviada;
    const registrada = await this.repositorio.anexarMensagem(atendimento.chave, {
      autor: "ura",
      texto,
    });
    return registrada.ok ? ok(undefined) : registrada;
  }

  private async enviarAviso(telefone: string, texto: string): Promise<Result<void, AppError>> {
    try {
      return await this.envio.enviar({ telefone, texto });
    } catch {
      return err(new ServicoExternoError("Falha ao enviar a mensagem."));
    }
  }
}
