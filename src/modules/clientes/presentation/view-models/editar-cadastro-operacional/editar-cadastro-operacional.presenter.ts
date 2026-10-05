// Espelha EditarCadastroOperacionalCliente.podeEditar (use-case, não
// exportado) — módulos não se importam entre si (arquitetura.md §3.4), mas a
// tela (`/clientes/[id]` e a busca inline do dashboard, #35) precisa da mesma
// regra pra decidir modo leitura/edição sem esperar o submit. Extraído pra
// não duplicar entre os dois consumidores (ponytail-review).
export function podeEditarCadastroOperacional(papel: string, setor: string): boolean {
  return (
    papel === "admin" ||
    ((papel === "lider_setor" || papel === "funcionario") && setor === "simples_nacional")
  );
}

// Só o Líder do SN atribui o Responsável (#65); espelha AtribuirResponsavelCliente.
export function podeAtribuirResponsavel(papel: string, setor: string): boolean {
  return papel === "lider_setor" && setor === "simples_nacional";
}
