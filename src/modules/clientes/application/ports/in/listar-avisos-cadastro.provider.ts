import type {
  CursorAvisoCadastro,
  PaginaAvisosCadastro,
} from "@/modules/clientes/application/dtos/aviso-cadastro.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export interface ListarAvisosCadastroPort {
  // Não vistos primeiro, depois do mais novo para o mais antigo; 30 por página.
  execute(cursor: CursorAvisoCadastro | null): Promise<Result<PaginaAvisosCadastro, AppError>>;
}
