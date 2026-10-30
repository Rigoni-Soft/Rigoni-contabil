import { redirect } from "next/navigation";

import { AuditoriaFeedPage } from "@/presentation/components/pages/auditoria-feed.page";
import { carregarSessao, validarSessao } from "@/presentation/view-models/shell/shell.server";
import { FeedContainer } from "@/modules/auditoria/presentation/view-models/feed/feed.container";
import { carregarFeedAuditoria } from "@/modules/auditoria/presentation/view-models/feed/feed.server";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";

export default async function Page() {
  const [sessaoOuNula, feed] = await Promise.all([carregarSessao(), carregarFeedAuditoria()]);
  const sessao = validarSessao(sessaoOuNula);
  if (!feed.ok) redirect("/");

  return (
    <AuditoriaFeedPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      feed={<FeedContainer initialData={feed.value} />}
    />
  );
}
