// Campo travado mostra um valor que não se edita: segue na cor plena, sem a opacidade de
// desabilitado (DESIGN.md "Sem opacidade de desabilitado"). Para um campo sozinho.
export const TRAVADO = "disabled:opacity-100";

// Para um grupo inteiro desativado (o `fieldset disabled` da visualização): os campos de valor
// seguem na cor plena; botões ficam de fora e continuam esmaecidos (não há o que acionar).
// As classes ficam por extenso: o Tailwind só gera o que lê literalmente.
export const VALORES_LEGIVEIS =
  "[&_input:disabled]:opacity-100 [&_select:disabled]:opacity-100 [&_textarea:disabled]:opacity-100";
