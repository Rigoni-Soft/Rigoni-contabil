import { NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL } from "@/env.client";
import { createBrowserClient } from "@supabase/ssr";

import type { UploadDeAnexoPort } from "@/modules/atendimento/application/ports/out/upload-de-anexo.provider";
import { TusUploadDeAnexoGateway } from "@/modules/atendimento/infra/gateways/tus-upload-de-anexo.gateway";

// Roda no navegador (sem server-only): a sessão vem do cookie que o middleware renova.
export function makeUploadDeAnexo(): UploadDeAnexoPort {
  const supabase = createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return new TusUploadDeAnexoGateway(
    NEXT_PUBLIC_SUPABASE_URL,
    async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  );
}
