"use client";

import { useId } from "react";

import { SinoAvisos } from "@/presentation/components/organisms/sino-avisos.component";
import { useSinoAvisos } from "@/modules/clientes/presentation/view-models/avisos-cadastro/use-sino-avisos.hook";

export function SinoAvisosContainer({ papel }: { papel: string }) {
  const painelId = useId();
  return <SinoAvisos painelId={painelId} {...useSinoAvisos(painelId, papel)} />;
}
