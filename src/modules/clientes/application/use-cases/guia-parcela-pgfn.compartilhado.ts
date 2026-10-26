import type { ArquivoInspecionavelPort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type {
  GuiaDaParcela,
  GuiaParcelaPgfnRepository,
} from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { GuiaParcelaPgfnProps } from "@/modules/clientes/domain/value-objects/guia-parcela-pgfn.vo";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Mesmo teto da Server Action (corpo de 4,5 MB na Vercel, ADR 0007): o Storage é relido aqui.
const LIMITE_BYTES = 4 * 1024 * 1024;

// Motivo da confirmação que o banco não aceitou na hora: o Funcionário confirma à mão.
const MOTIVO_CONFIRMACAO_FALHOU =
  "Não consegui confirmar a guia na hora: confira e confirme à mão.";

// Não confia só na tela: relê no Storage o tipo e o tamanho do que subiu. Devolve a recusa, ou nulo.
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
  if (objeto.value.tamanho > LIMITE_BYTES) {
    return new ValidationError("O arquivo passa de 4 MB. Envie um arquivo menor.");
  }
  return null;
}

// Sem motivo a guia é confirmada na hora; se o banco recusar, ela segue "a confirmar" (a confirmação
// à mão continua valendo) e o arquivo e a linha não se perdem.
export async function confirmarOuManter(
  guias: GuiaParcelaPgfnRepository,
  parcelamentoId: string,
  guia: Pick<GuiaParcelaPgfnProps, "competencia" | "contaNegociacao">,
  motivo: string | null,
): Promise<Result<GuiaDaParcela, AppError>> {
  const base = { competencia: guia.competencia, contaNegociacao: guia.contaNegociacao };
  if (motivo) return ok({ ...base, estado: "a_confirmar", motivo });
  const confirmada = await guias.confirmar(parcelamentoId, guia.competencia);
  if (confirmada.ok) return ok({ ...base, estado: "confirmada" });
  return ok({ ...base, estado: "a_confirmar", motivo: MOTIVO_CONFIRMACAO_FALHOU });
}

// Falha da própria remoção não é mascarada como o erro original: o arquivo ficou órfão.
export async function desfazerUpload(
  storage: ArquivoInspecionavelPort,
  parcelamentoId: string,
  caminho: string,
  erro: AppError,
): Promise<Result<never, AppError>> {
  const removido = await storage.remover([caminho]);
  if (removido.ok) return err(erro);
  console.error(
    `Falha ao remover guia órfã (parcelamento=${parcelamentoId}, caminho=${caminho}):`,
    removido.error.message,
  );
  return err(
    new EstadoInconsistenteError(
      "Não foi possível anexar a guia nem remover o arquivo enviado. Avise o suporte.",
      parcelamentoId,
    ),
  );
}
