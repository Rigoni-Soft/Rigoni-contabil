// Botão ocupado (ação em andamento): fica `aria-disabled` e não `disabled`, para o navegador não soltar o
// foco dele (DESIGN.md, "Foco do teclado depois da ação"). A classe apaga e desliga o clique do botão.
export const BOTAO_OCUPADO = "aria-disabled:pointer-events-none aria-disabled:opacity-50";
