// Sinalização visual de campo obrigatório: asterisco visível, fora do texto acessível (screen readers
// já anunciam "obrigatório" via `aria-required` no próprio input, não aqui).
export function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      {" "}
      *
    </span>
  );
}
