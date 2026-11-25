"use client";

import { useAvisoGlobal } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-aviso-global.hook";

export function AvisoGlobalContainer() {
  useAvisoGlobal();
  return null;
}
