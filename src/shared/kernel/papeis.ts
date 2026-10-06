// Responsável cujo perfil a RLS esconde de quem lê (leitor de outro Setor, #65).
export const RESPONSAVEL_OUTRO_SETOR_LABEL = "Responsável de outro setor";

// Rótulos de Papel em português, reusados por qualquer tela que precise
// exibi-los (ShellHeader) ou listá-los como opção de formulário
// (cadastro de Líder/Funcionário) — extraído para shared/kernel pelo mesmo
// motivo de SETORES: mais de um componente de presentation/ global precisa
// da mesma lista, sem poder importar de dentro do módulo usuarios
// (arquitetura.md, seção 3.4).
export type Papel = "admin" | "lider_setor" | "funcionario";

export const PAPEL_LABEL: Record<string, string> = {
  admin: "Admin",
  lider_setor: "Líder de setor",
  funcionario: "Funcionário",
};

// Papéis que alguém (Admin ou Líder de setor) pode cadastrar via
// /admin/usuarios/novo — Admin nunca aparece aqui (#30/#32: ninguém cadastra
// outro Admin pela UI). Mesmo motivo de SETORES: reusado por página global
// (app/), container e form (presentation/ global), que não podem importar
// o tipo equivalente de dentro do módulo usuarios (arquitetura.md §3.4).
export const PAPEIS_CADASTRAVEIS = ["lider_setor", "funcionario"] as const;
export type PapelCadastravel = (typeof PAPEIS_CADASTRAVEIS)[number];

export const SEM_RESPONSAVEL_LABEL = "Sem responsável";
// Id da fatia "Sem responsável" no comparativo (#65), também chave de cor na View.
export const SEM_RESPONSAVEL_ID = "sem_responsavel";

export function rotuloResponsavel(id: string | null, nome: string | null): string {
  return id ? (nome ?? RESPONSAVEL_OUTRO_SETOR_LABEL) : SEM_RESPONSAVEL_LABEL;
}

// Quem edita o cadastro operacional SN: Admin, ou Líder/Funcionário do Simples
// Nacional (Funcionário só dos clientes pelos quais é Responsável — isso é RLS).
// Regra única pro caso de uso e pra tela decidirem modo leitura/edição (#65).
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

// Só o Líder do Simples Nacional atribui/troca/remove o Responsável (#65).
export function podeAtribuirResponsavel(papel: string, setor: string): boolean {
  return papel === "lider_setor" && setor === "simples_nacional";
}
