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
import { podeEditarCadastroOperacional } from "@/shared/kernel/papeis";
import { regimeTemCadastroOperacionalSn } from "@/shared/kernel/regimes";
import { err, ok, type Result } from "@/shared/kernel/result";

// Tamanho e tipo do PDF são barrados pelo schema da Server Action (única entrada da porta); o PDF
// vai a bucket privado, só pelo servidor, depois da checagem de papel daqui.
type Upload = { caminho: string; arquivo: File };

export class SalvarParcelamentosCliente implements SalvarParcelamentosClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly clientes: ClienteRepository,
    private readonly parcelamentos: ClienteParcelamentoRepository,
    private readonly storage: ArquivoStoragePort,
  ) {}

  async execute(
    input: SalvarParcelamentosClienteInput,
  ): Promise<Result<{ ids: string[] }, AppError>> {
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

    const enviados = await this.enviarArquivos(input.clienteId, uploads);
    if (!enviados.ok) return enviados;

    const salvo = await this.parcelamentos.salvar(input.clienteId, itens);
    if (!salvo.ok) {
      const confirmado = await this.reconciliar(input.clienteId, salvo.error, enviados.value);
      if (confirmado.ok && !confirmado.value) return salvo;
      if (!confirmado.ok) return confirmado;
    }

    // Só apaga o PDF de quem saiu do conjunto e cujo caminho nenhum Parcelamento mantido referencia.
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
      // PDF só no Parcelamento novo; o existente mantém o anexo gravado.
      const upload =
        atual || !entrada.arquivo
          ? undefined
          : {
              caminho: `${input.clienteId}/${id}-${entrada.arquivo.name.replace(/[/\\]/g, "_")}`,
              arquivo: entrada.arquivo,
            };

      // Quitado é decidido pelo banco, e o da PGFN só ganha guias (as restantes mudam pelo sistema):
      // nenhum dos dois se edita, voltam exatamente como estão.
      const item =
        atual?.quitado || atual?.acordo?.origem === "pgfn"
          ? ok(atual)
          : validarParcelamento({
              id,
              // Código em branco é opcional: mantém o gravado ou o sistema gera um.
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

  // Falha definitiva: apaga os uploads. Resultado incerto: lê o banco; gravado = segue como sucesso;
  // qualquer outro desfecho mantém os arquivos (nunca apaga sob incerteza).
  // ok(true) = o banco confirmou a gravação; ok(false) = falha definitiva e uploads apagados.
  private async reconciliar(
    clienteId: string,
    erro: AppError,
    enviados: string[],
  ): Promise<Result<boolean, AppError>> {
    if (!(erro instanceof ResultadoIncertoError)) {
      await this.apagarAnexos(clienteId, enviados);
      return ok(false);
    }
    const atuais = await this.parcelamentos.listar(clienteId);
    // Sem upload novo não há caminho que prove o desfecho: fica sem reconciliar.
    // Ausência na leitura NÃO prova rollback (commit tardio, linha oculta por RLS): só a presença
    // de todos os caminhos confirma; qualquer outra coisa preserva os PDFs.
    if (atuais.ok && enviados.length > 0) {
      const gravados = new Set(atuais.value.map((p) => p.arquivoCaminho));
      if (enviados.every((c) => gravados.has(c))) return ok(true);
    }
    return err(
      new EstadoInconsistenteError(
        "Não foi possível confirmar se os Parcelamentos foram salvos. Os PDFs foram mantidos; recarregue a página e confira antes de tentar de novo.",
        clienteId,
      ),
    );
  }

  // Sobe os PDFs novos; se um falhar, apaga os que já subiram.
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

  // Falha ao apagar deixa PDF órfão em bucket privado: não desfaz o que já foi gravado.
  private async apagarAnexos(clienteId: string, caminhos: string[]): Promise<void> {
    const removido = await this.storage.remover(caminhos);
    if (!removido.ok) {
      console.error(
        `Falha ao remover PDF de Parcelamento (cliente=${clienteId}):`,
        removido.error.message,
      );
    }
  }
}
