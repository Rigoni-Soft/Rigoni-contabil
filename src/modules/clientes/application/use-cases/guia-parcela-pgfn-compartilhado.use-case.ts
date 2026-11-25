import type {
  ArquivoInspecionavelPort,
  ArquivoStoragePort,
} from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type {
  GuiaDaParcela,
  GuiaParcelaPgfnRepository,
} from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { RegistroDeErrosPort } from "@/modules/clientes/application/ports/out/registro-de-erros.provider";
import type { GuiaParcelaPgfnProps } from "@/modules/clientes/domain/value-objects/guia-parcela-pgfn.vo";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const LIMITE_DO_PDF_DA_GUIA_EM_BYTES = 4 * 1024 * 1024;

const MOTIVO_CONFIRMACAO_FALHOU =
  "Não consegui confirmar a guia na hora: confira e confirme à mão.";

export async function revalidarPdfNoStorage(
  storage: ArquivoInspecionavelPort,
  caminho: string,
): Promise<AppError | null> {
  const objeto = await storage.inspecionar(caminho);
  if (!objeto.ok) return objeto.error;
  if (!objeto.value) return new ValidationError("Não foi possível conferir o arquivo enviado.");
  if (objeto.value.tipoMime !== "application/pdf") {
    return new ValidationError("A guia precisa ser um PDF.");
  }
  if (objeto.value.tamanho > LIMITE_DO_PDF_DA_GUIA_EM_BYTES) {
    return new ValidationError("O arquivo passa de 4 MB. Envie um arquivo menor.");
  }
  return null;
}

export async function confirmarOuManter(
  guias: GuiaParcelaPgfnRepository,
  parcelamentoId: string,
  guia: GuiaParcelaPgfnProps,
  motivo: string | null,
): Promise<Result<GuiaDaParcela, AppError>> {
  const base = {
    competencia: guia.competencia,
    contaNegociacao: guia.contaNegociacao,
    versao: guia.arquivoCaminho,
  };
  if (motivo) return ok({ ...base, estado: "a_confirmar", motivo });
  const confirmada = await guias.confirmar(parcelamentoId, guia.competencia, guia.arquivoCaminho);
  if (confirmada.ok) return ok({ ...base, estado: "confirmada" });
  return ok({ ...base, estado: "a_confirmar", motivo: MOTIVO_CONFIRMACAO_FALHOU });
}

export async function apagarObjeto(
  storage: ArquivoStoragePort,
  erros: RegistroDeErrosPort,
  contexto: string,
  caminho: string,
): Promise<void> {
  const removido = await storage.remover([caminho]);
  if (!removido.ok) {
    erros.registrar(
      `Falha ao remover o PDF da guia (${contexto}, caminho=${caminho}):`,
      removido.error.message,
    );
  }
}

export async function desfazerUpload(
  storage: ArquivoInspecionavelPort,
  erros: RegistroDeErrosPort,
  parcelamentoId: string,
  caminho: string,
  erro: AppError,
): Promise<Result<never, AppError>> {
  const removido = await storage.remover([caminho]);
  if (removido.ok) return err(erro);
  erros.registrar(
    `Falha ao remover guia órfã (parcelamento=${parcelamentoId}, caminho=${caminho}):`,
    removido.error.message,
  );
  return err(
    new EstadoInconsistenteError(
      "Não foi possível gravar a guia nem remover o arquivo enviado. Avise o suporte.",
      parcelamentoId,
    ),
  );
}
