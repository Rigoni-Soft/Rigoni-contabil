// O tipo que vale para "todos os envios do Setor" (no banco, o Destino de tipo nulo).
export const TIPO_TODOS_OS_ENVIOS = "todos";

// Os tipos de envio que os jobs fazem (o catálogo `tipos_de_envio` do banco), com o rótulo que entra
// na frase "sem meio de envio para ...".
export const ROTULO_DO_ENVIO = {
  lembrete_documento: "o lembrete de documento",
  das: "o DAS",
  guia_parcelamento: "a guia de parcelamento",
} as const;
export type TipoDeEnvio = keyof typeof ROTULO_DO_ENVIO;
