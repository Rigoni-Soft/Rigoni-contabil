// Rótulos de Papel em português, reusados por qualquer tela que precise
// exibi-los (ShellHeader) ou listá-los como opção de formulário
// (cadastro de Líder/Funcionário) — extraído para shared/kernel pelo mesmo
// motivo de SETORES: mais de um componente de presentation/ global precisa
// da mesma lista, sem poder importar de dentro do módulo usuarios
// (arquitetura.md, seção 3.4).
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
