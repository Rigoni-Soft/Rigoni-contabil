import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ContaCriada = { id: string; senhaProvisoria: string };

// Só a criação de conta (Admin API do Supabase Auth) passa por essa porta — é a
// única razão de o service_role existir no sistema (ver docs/adr/0001). A senha
// provisória é gerada aqui (infra), não na application: geração aleatória usa
// `crypto`, e application só pode importar shared/domain/application (Anexo A).
export interface AuthAdminPort {
  criarConta(email: string): Promise<Result<ContaCriada, AppError>>;
  // Compensação para falha depois da conta criada no Auth: `perfis.id` referencia
  // `auth.users(id) on delete cascade`, então remover a conta limpa o perfil junto.
  removerConta(id: string): Promise<Result<void, AppError>>;
  // Bloqueia login/refresh de token da conta (soft delete — conta e perfil
  // continuam existindo). Idempotente.
  banirConta(id: string): Promise<Result<void, AppError>>;
}
