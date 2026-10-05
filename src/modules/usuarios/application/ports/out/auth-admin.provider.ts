import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ContaCriada = { id: string; senhaProvisoria: string };

// Só a criação de conta (Admin API do Supabase Auth) passa por essa porta — é a
// única razão de o service_role existir no sistema (ver docs/adr/0001). A senha
// provisória é gerada aqui (infra), não na application: geração aleatória usa
// `crypto`, e application só pode importar shared/domain/application (Anexo A).
export interface AuthAdminPort {
  criarConta(email: string): Promise<Result<ContaCriada, AppError>>;
  // Devolutiva técnica PR #61, ponto 1: compensação pra qualquer falha depois
  // da conta já criada no Auth (domínio inválido, INSERT em perfis, auditoria
  // obrigatória) — `perfis.id` referencia `auth.users(id) on delete cascade`,
  // então remover a conta aqui já limpa o perfil junto, se ele chegou a existir.
  removerConta(id: string): Promise<Result<void, AppError>>;
  // #58: bloqueia login/refresh de token da conta (soft delete — a conta e o perfil
  // continuam existindo). Idempotente.
  banirConta(id: string): Promise<Result<void, AppError>>;
}
