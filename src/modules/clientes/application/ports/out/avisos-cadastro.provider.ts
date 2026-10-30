import type {
  AvisoCadastroDto,
  CursorAvisoCadastro,
} from "@/modules/clientes/application/dtos/aviso-cadastro.dto";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Sessão do usuário (RLS): cada um só enxerga e marca os próprios avisos.
export interface AvisosCadastroPort {
  listar(
    cursor: CursorAvisoCadastro | null,
    limite: number,
  ): Promise<Result<AvisoCadastroDto[], AppError>>;
  contarNaoVistos(): Promise<Result<number, AppError>>;
  marcarVisto(avisoId: string): Promise<Result<void, AppError>>;
}
