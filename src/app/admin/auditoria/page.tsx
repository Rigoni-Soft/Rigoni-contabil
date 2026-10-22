import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { AuditoriaFeedPage } from "@/presentation/components/pages/auditoria-feed.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { FeedContainer } from "@/modules/auditoria/presentation/view-models/feed/feed.container";
import { carregarFeedAuditoria } from "@/modules/auditoria/presentation/view-models/feed/feed.server";
import { SinoAvisosContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/sino-avisos.container";

export default async function Page() {
  const [sessao, feed] = await Promise.all([carregarSessao(), carregarFeedAuditoria()]);
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");
  if (!feed.ok) redirect("/");

  return (
    <AuditoriaFeedPage
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
          avisos={<SinoAvisosContainer usuarioId={sessao.id} />}
        />
      }
      feed={<FeedContainer initialData={feed.value} />}
    />
  );
}
