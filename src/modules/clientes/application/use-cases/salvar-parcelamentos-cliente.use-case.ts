import type {
  SalvarParcelamentosClienteInput,
  SalvarParcelamentosClientePort,
} from "@/modules/clientes/application/ports/in/salvar-parcelamentos-cliente.provider";
import type { ArquivoStoragePort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type {
  ClienteParcelamentoRepository,
  ParcelamentoSalvo,
} from "@/modules/clientes/application/ports/out/cliente-parcelamento.repository";
import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type { RegistroDeErrosPort } from "@/modules/clientes/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import {
  gerarCodigoDeParcelamento,
  validarParcelamento,
  type ParcelamentoProps,
} from "@/modules/clientes/domain/value-objects/parcelamento.vo";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { podeGerirParcelamento } from "@/shared/kernel/papeis";
import { regimeTemCadastroOperacionalSn } from "@/shared/kernel/regimes";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

type Upload = { caminho: string; arquivo: File };

type DesfechoDaGravacaoIncerta = "gravacao_confirmada" | "gravacao_falhou";

const semBarras = (nomeDoArquivo: string) => nomeDoArquivo.replace(/[/\\]/g, "_");

const naoEditavelPeloUsuario = (atual: ParcelamentoSalvo): boolean =>
  atual.quitado || atual.acordo?.origem === "pgfn";

export class SalvarParcelamentosCliente implements SalvarParcelamentosClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly clientes: ClienteRepository,
    private readonly parcelamentos: ClienteParcelamentoRepository,
    private readonly storage: ArquivoStoragePort,
    private readonly erros: RegistroDeErrosPort,
  ) {}

  async execute(
    input: SalvarParcelamentosClienteInput,
  ): Promise<Result<{ ids: string[] }, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeGerirParcelamento(ator.papel, ator.setor, input.setor)) {
      return err(
        new ForbiddenError("Só Admin, Líder ou Funcionário do Setor editam os Parcelamentos dele."),
      );
    }

    const cliente = await this.clientes.buscarPorId(input.clienteId);
    if (!cliente.ok) return cliente;
    if (!cliente.value) {
      return err(
        new NotFoundError("Não encontramos este cliente. Atualize a página e tente novamente."),
      );
    }
    if (
      input.setor === "simples_nacional" &&
      !regimeTemCadastroOperacionalSn(cliente.value.regime.valor)
    ) {
      return err(
        new ValidationError("O Cadastro operacional SN não se aplica ao Regime deste Cliente."),
      );
    }

    const existentes = await this.parcelamentos.listar(input.clienteId, input.setor);
    if (!existentes.ok) return existentes;

    const montados = this.montar(input, existentes.value);
    if (!montados.ok) return montados;
    const { itens, uploads } = montados.value;

    const enviados = await this.enviarArquivos(input.clienteId, uploads);
    if (!enviados.ok) return enviados;

    const salvo = await this.parcelamentos.salvar(input.clienteId, input.setor, itens);
    if (!salvo.ok) {
      const desfecho = await this.reconciliar(
        input.clienteId,
        input.setor,
        salvo.error,
        enviados.value,
      );
      if (!desfecho.ok) return desfecho;
      if (desfecho.value === "gravacao_falhou") return salvo;
    }

    const mantidos = new Set(itens.map((item) => item.id));
    const caminhosEmUso = new Set(itens.map((item) => item.arquivoCaminho));
    await this.apagarAnexos(
      input.clienteId,
      existentes.value
        .filter((p) => !mantidos.has(p.id) && !caminhosEmUso.has(p.arquivoCaminho))
        .map((p) => p.arquivoCaminho),
    );
    return ok({ ids: itens.map((item) => item.id) });
  }

  private montar(
    input: SalvarParcelamentosClienteInput,
    existentes: ParcelamentoSalvo[],
  ): Result<{ itens: ParcelamentoProps[]; uploads: Upload[] }, AppError> {
    const itens: ParcelamentoProps[] = [];
    const uploads: Upload[] = [];
    const codigos = new Set<string>();

    for (const entrada of input.parcelamentos) {
      const atual = existentes.find((p) => p.id === entrada.id);
      if (entrada.id && !atual) {
        return err(new ValidationError("Parcelamento não encontrado. Atualize a página."));
      }
      const id = atual?.id ?? crypto.randomUUID();
      const upload =
        atual || !entrada.arquivo
          ? undefined
          : {
              caminho: `${input.clienteId}/${id}-${semBarras(entrada.arquivo.name)}`,
              arquivo: entrada.arquivo,
            };

      const item =
        atual && naoEditavelPeloUsuario(atual)
          ? ok(atual)
          : validarParcelamento({
              id,
              codigo: entrada.codigo.trim() || atual?.codigo || gerarCodigoDeParcelamento(),
              parcelasRestantes: entrada.parcelasRestantes,
              interno: entrada.interno,
              arquivoCaminho: atual?.arquivoCaminho ?? upload?.caminho ?? "",
              acordo: atual ? undefined : entrada.acordo,
            });
      if (!item.ok) return item;

      const chave = item.value.codigo.toLowerCase();
      if (codigos.has(chave)) {
        return err(new ValidationError(`Código repetido: ${item.value.codigo}.`));
      }
      codigos.add(chave);
      itens.push(item.value);
      if (upload) uploads.push(upload);
    }
    return ok({ itens, uploads });
  }

  private async reconciliar(
    clienteId: string,
    setor: SetorSlug,
    erro: AppError,
    enviados: string[],
  ): Promise<Result<DesfechoDaGravacaoIncerta, AppError>> {
    if (!(erro instanceof ResultadoIncertoError)) {
      await this.apagarAnexos(clienteId, enviados);
      return ok("gravacao_falhou");
    }
    const atuais = await this.parcelamentos.listar(clienteId, setor);
    if (atuais.ok && enviados.length > 0) {
      const gravados = new Set(atuais.value.map((p) => p.arquivoCaminho));
      if (enviados.every((c) => gravados.has(c))) return ok("gravacao_confirmada");
    }
    return err(
      new EstadoInconsistenteError(
        "Não foi possível confirmar se os Parcelamentos foram salvos. Os PDFs foram mantidos; recarregue a página e confira antes de tentar de novo.",
        clienteId,
      ),
    );
  }

  private async enviarArquivos(
    clienteId: string,
    uploads: Upload[],
  ): Promise<Result<string[], AppError>> {
    const enviados: string[] = [];
    for (const { caminho, arquivo } of uploads) {
      const enviado = await this.storage.enviar(caminho, arquivo);
      if (!enviado.ok) {
        await this.apagarAnexos(clienteId, enviados);
        return enviado;
      }
      enviados.push(caminho);
    }
    return ok(enviados);
  }

  private async apagarAnexos(clienteId: string, caminhos: string[]): Promise<void> {
    const removido = await this.storage.remover(caminhos);
    if (!removido.ok) {
      this.erros.registrar(
        `Falha ao remover PDF de Parcelamento (cliente=${clienteId}):`,
        removido.error.message,
      );
    }
  }
}
