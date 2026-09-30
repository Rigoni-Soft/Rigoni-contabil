// Espelha EditarCadastroOperacionalCliente.podeEditar (use-case, não
// exportado) — módulos não se importam entre si (arquitetura.md §3.4), mas a
// tela (`/clientes/[id]` e a busca inline do dashboard, #35) precisa da mesma
// regra pra decidir modo leitura/edição sem esperar o submit. Extraído pra
// não duplicar entre os dois consumidores (ponytail-review).
export function podeEditarCadastroOperacional(papel: string, setor: string): boolean {
  return papel === "admin" || (papel === "funcionario" && setor === "simples_nacional");
}
