import type { Metadata } from "next";

import { PrivacidadePage } from "@/presentation/components/pages/privacidade.page";

export const metadata: Metadata = { title: "Política de Privacidade" };

// Pública de propósito (PAGINAS_PUBLICAS em scripts/check-troca-senha-guard.mjs): a Meta precisa abri-la sem login.
export default function Page() {
  return <PrivacidadePage />;
}
