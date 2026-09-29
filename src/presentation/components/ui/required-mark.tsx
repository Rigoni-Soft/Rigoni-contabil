// Sinalização visual de campo obrigatório (ponto 6 do feedback manual,
// 2026-09-29) — asterisco visível, fora do texto acessível (screen readers já
// anunciam "obrigatório" via `aria-required` no próprio input, não aqui).
export function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      {" "}
      *
    </span>
  );
}
