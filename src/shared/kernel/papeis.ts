// Responsável cujo perfil a RLS esconde de quem lê (leitor de outro Setor).
export const RESPONSAVEL_OUTRO_SETOR_LABEL = "Responsável de outro setor";

export const PAPEIS = ["admin", "lider_setor", "funcionario"] as const;
export type Papel = (typeof PAPEIS)[number];

// Rótulos de Papel em português, reusados por qualquer tela que precise exibi-los (ShellHeader) ou
// listá-los como opção de formulário. Ficam em shared/kernel porque presentation/ global não pode
// importar de dentro do módulo usuarios (arquitetura.md, seção 3.4).
export const PAPEL_LABEL: Record<string, string> = {
  admin: "Admin",
  lider_setor: "Líder de setor",
  funcionario: "Funcionário",
};

// Papéis que alguém (Admin ou Líder de setor) pode cadastrar via /admin/usuarios/novo — Admin nunca
// aparece aqui (ninguém cadastra outro Admin pela UI). Reusado por página global (app/), container e
// form (presentation/ global), que não podem importar do módulo usuarios (arquitetura.md §3.4).
export const PAPEIS_CADASTRAVEIS = ["lider_setor", "funcionario"] as const;
export type PapelCadastravel = (typeof PAPEIS_CADASTRAVEIS)[number];

export const SEM_RESPONSAVEL_LABEL = "Sem responsável";
// Id da fatia "Sem responsável" no comparativo, também chave de cor na View.
export const SEM_RESPONSAVEL_ID = "sem_responsavel";

export function rotuloResponsavel(id: string | null, nome: string | null): string {
  return id ? (nome ?? RESPONSAVEL_OUTRO_SETOR_LABEL) : SEM_RESPONSAVEL_LABEL;
}

// Quem edita o cadastro operacional SN: Admin, ou Líder/Funcionário do Simples
// Nacional (Funcionário só dos clientes pelos quais é Responsável — isso é RLS).
// Regra única pro caso de uso e pra tela decidirem modo leitura/edição.
export function podeEditarCadastroOperacional(papel: string, setor: string): boolean {
  return (
    papel === "admin" ||
    ((papel === "lider_setor" || papel === "funcionario") && setor === "simples_nacional")
  );
}

// Quem enxerga o dashboard do Simples Nacional: Admin (suporte) ou qualquer perfil do setor.
export function podeVerDashboardSn(papel: string, setor: string): boolean {
  return papel === "admin" || setor === "simples_nacional";
}

// O Líder de cada Setor atribui/troca/remove o Responsável do Cliente naquele Setor. A Recepção não
// tem Responsável: a espera dela é comum.
export function podeAtribuirResponsavel(papel: string, setor: string): boolean {
  return papel === "lider_setor" && setor !== "recepcao";
}

// Anexar alteração contratual a um Cliente existente é dado jurídico: só o Admin.
export function podeAnexarAlteracaoContratual(papel: string): boolean {
  return papel === "admin";
}
