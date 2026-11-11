import type { ConvencaoDto } from "@/modules/rh/application/dtos/convencao.dto";
import type { RegrasDaConvencao } from "@/modules/rh/domain/value-objects/regras-da-convencao.vo";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type NovaConvencao = {
  clienteId: string;
  sindicato: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  arquivoCaminho: string;
  arquivoNome: string;
  regras: RegrasDaConvencao;
};

// O banco (RLS) é a última barreira: só o Líder do RH e o Admin inserem; a convenção nunca é alterada.
export interface ConvencaoRepository {
  // Histórico do Cliente, a de vigência mais recente primeiro.
  listar(clienteId: string): Promise<Result<ConvencaoDto[], AppError>>;
  inserir(nova: NovaConvencao): Promise<Result<void, AppError>>;
}
