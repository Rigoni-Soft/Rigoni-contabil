import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ContaCriada = { id: string; senhaProvisoria: string };

// Só a criação de conta (Admin API do Supabase Auth) passa por essa porta — é a
// única razão de o service_role existir no sistema (ver docs/adr/0001). A senha
// provisória é gerada aqui (infra), não na application: geração aleatória usa
// `crypto`, e application só pode importar shared/domain/application (Anexo A).
export interface AuthAdminPort {
  criarConta(email: string): Promise<Result<ContaCriada, AppError>>;
}
