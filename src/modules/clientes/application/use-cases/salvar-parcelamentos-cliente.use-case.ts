import type {
  ParcelamentoEntrada,
  SalvarParcelamentosClienteInput,
  SalvarParcelamentosClientePort,
} from "@/modules/clientes/application/ports/in/salvar-parcelamentos-cliente.provider";
import type { ArquivoStoragePort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type {
  ClienteParcelamentoRepository,
  ParcelamentoGravar,
  ParcelamentoSalvo,
} from "@/modules/clientes/application/ports/out/cliente-parcelamento.repository";
import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { Parcelamento } from "@/modules/clientes/domain/value-objects/parcelamento.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { podeEditarCadastroOperacional } from "@/shared/kernel/papeis";
import { regimeTemCadastroOperacionalSn } from "@/shared/kernel/regimes";
import { err, ok, type Result } from "@/shared/kernel/result";

// Tamanho e tipo do PDF são barrados pelo schema da Server Action (única entrada da porta). Quem é
// Responsável do Cliente é a RLS; a auditoria de sucesso nasce de gatilho, na mesma transação.
// O PDF é guardado em bucket privado, só pelo servidor, depois de checar o papel aqui.
export class SalvarParcelamentosCliente implements SalvarParcelamentosClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly clientes: ClienteRepository,
    private readonly parcelamentos: ClienteParcelamentoRepository,
    private readonly storage: ArquivoStoragePort,
  ) {}

  async execute(input: SalvarParcelamentosClienteInput): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeEditarCadastroOperacional(ator.papel, ator.setor)) {
      return err(
        new ForbiddenError(
          "Só Admin, Líder ou Funcionário do Simples Nacional editam os Parcelamentos.",
        ),
      );
    }

    const cliente = await this.clientes.buscarPorId(input.clienteId);
    if (!cliente.ok) return cliente;
    if (!cliente.value) {
      return err(
        new NotFoundError("Não encontramos este cliente. Atualize a página e tente novamente."),
      );
    }
    if (!regimeTemCadastroOperacionalSn(cliente.value.regime.valor)) {
      return err(
        new ValidationError("O Cadastro operacional SN não se aplica ao Regime deste Cliente."),
      );
    }

    const existentes = await this.parcelamentos.listar(input.clienteId);
    if (!existentes.ok) return existentes;

    const montados = this.montar(input, existentes.value);
    if (!montados.ok) return montados;
    const { itens, uploads } = montados.value;

    const enviados: string[] = [];
    for (const { caminho, arquivo } of uploads) {
      const enviado = await this.storage.enviar(caminho, arquivo);
      if (!enviado.ok) {
        await this.desfazer(input.clienteId, enviados);
        return enviado;
      }
      enviados.push(caminho);
    }

    const salvo = await this.parcelamentos.salvar(input.clienteId, itens);
    if (!salvo.ok) {
      await this.desfazer(input.clienteId, enviados);
      return salvo;
    }

    const mantidos = new Set(itens.map((item) => item.id));
    await this.apagarAnexos(
      input.clienteId,
      existentes.value.filter((p) => !mantidos.has(p.id)).map((p) => p.arquivoCaminho),
    );
    return ok(undefined);
  }

  private montar(
    input: SalvarParcelamentosClienteInput,
    existentes: ParcelamentoSalvo[],
  ): Result<
    { itens: ParcelamentoGravar[]; uploads: { caminho: string; arquivo: File }[] },
    AppError
  > {
    const itens: ParcelamentoGravar[] = [];
    const uploads: { caminho: string; arquivo: File }[] = [];
    const codigos = new Set<string>();

    for (const entrada of input.parcelamentos) {
      const item = this.montarItem(input.clienteId, entrada, existentes);
      if (!item.ok) return item;
      const chave = item.value.gravar.codigo.toLowerCase();
      if (codigos.has(chave)) {
        return err(new ValidationError(`Código repetido: ${item.value.gravar.codigo}.`));
      }
      codigos.add(chave);
      itens.push(item.value.gravar);
      if (item.value.upload) uploads.push(item.value.upload);
    }
    return ok({ itens, uploads });
  }

  private montarItem(
    clienteId: string,
    entrada: ParcelamentoEntrada,
    existentes: ParcelamentoSalvo[],
  ): Result<{ gravar: ParcelamentoGravar; upload?: { caminho: string; arquivo: File } }, AppError> {
    if (entrada.id) {
      const atual = existentes.find((p) => p.id === entrada.id);
      if (!atual) {
        return err(new ValidationError("Parcelamento não encontrado. Atualize a página."));
      }
      // Quitado é decidido pelo banco e não se edita: volta exatamente como está.
      if (atual.quitado) {
        const { id, codigo, parcelasRestantes, interno, arquivoCaminho } = atual;
        return ok({ gravar: { id, codigo, parcelasRestantes, interno, arquivoCaminho } });
      }
      const valido = Parcelamento.criar({
        id: atual.id,
        codigo: entrada.codigo,
        parcelasRestantes: entrada.parcelasRestantes,
        interno: entrada.interno,
        arquivoCaminho: atual.arquivoCaminho,
      });
      return valido.ok ? ok({ gravar: valido.value.paraGravar() }) : valido;
    }

    if (!entrada.arquivo) return err(new ValidationError("Anexe o PDF do parcelamento."));
    const id = crypto.randomUUID();
    const caminho = `${clienteId}/${id}-${entrada.arquivo.name.replace(/[\\/]/g, "_")}`;
    const valido = Parcelamento.criar({
      id,
      codigo: entrada.codigo,
      parcelasRestantes: entrada.parcelasRestantes,
      interno: entrada.interno,
      arquivoCaminho: caminho,
    });
    return valido.ok
      ? ok({ gravar: valido.value.paraGravar(), upload: { caminho, arquivo: entrada.arquivo } })
      : valido;
  }

  private async desfazer(clienteId: string, caminhos: string[]): Promise<void> {
    await this.apagarAnexos(clienteId, caminhos);
  }

  // Falha ao apagar deixa PDF órfão em bucket privado: não desfaz o que já foi gravado.
  private async apagarAnexos(clienteId: string, caminhos: string[]): Promise<void> {
    if (caminhos.length === 0) return;
    const removido = await this.storage.remover(caminhos);
    if (!removido.ok) {
      console.error(
        `Falha ao remover PDF de Parcelamento (cliente=${clienteId}):`,
        removido.error.message,
      );
    }
  }
}
