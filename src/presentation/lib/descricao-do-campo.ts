// Valor de `aria-describedby` do campo: o que o chamador já ligou (`externo`), a ajuda fixa e a
// mensagem de erro/aviso. Sem nenhum, `undefined` (atributo ausente).
export function descricaoDoCampo(
  ...ids: (string | false | null | undefined)[]
): string | undefined {
  const ligados = ids.filter(Boolean);
  return ligados.length > 0 ? ligados.join(" ") : undefined;
}
