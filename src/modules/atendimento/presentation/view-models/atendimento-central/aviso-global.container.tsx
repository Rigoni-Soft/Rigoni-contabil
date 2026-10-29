"use client";

import { useAvisoGlobal } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-aviso-global.hook";

// Sem interface: só mantém a leitura e o som vivos em qualquer tela (montado no layout raiz).
export function AvisoGlobalContainer() {
  useAvisoGlobal();
  return null;
}
