import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { AuditoriaFeedPage } from "@/presentation/components/pages/auditoria-feed.page";
import { Button } from "@/presentation/components/ui/button";
import { logoutAction } from "@/presentation/view-models/shell/logout.actions";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { FeedContainer } from "@/modules/auditoria/presentation/view-models/feed/feed.container";
import { carregarFeedAuditoria } from "@/modules/auditoria/presentation/view-models/feed/feed.server";

export default async function Page() {
  const [sessao, feed] = await Promise.all([carregarSessao(), carregarFeedAuditoria()]);
  if (!sessao) redirect("/login");
  if (!feed.ok) redirect("/");

  return (
    <AuditoriaFeedPage
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut aria-hidden="true" />
                Sair
              </Button>
            </form>
          }
        />
      }
      feed={<FeedContainer initialData={feed.value} />}
    />
  );
}
