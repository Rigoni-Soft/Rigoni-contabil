// O tipo que vale para "todos os envios do Setor" (no banco, o Destino de tipo nulo).
export const TIPO_TODOS_OS_ENVIOS = "todos";

// Os tipos de envio que os jobs fazem (o catálogo `tipos_de_envio` do banco).
export type TipoDeEnvio = "lembrete_documento" | "das" | "guia_parcelamento";
