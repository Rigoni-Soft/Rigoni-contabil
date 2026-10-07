import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { FeriadosPage } from "@/presentation/components/pages/feriados.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { FeriadosContainer } from "@/modules/atendimento/presentation/view-models/feriados/feriados.container";
import { carregarFeriados } from "@/modules/atendimento/presentation/view-models/feriados/feriados.server";

export default async function Page() {
  const [sessao, feriados] = await Promise.all([carregarSessao(), carregarFeriados()]);
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");
  if (!feriados.ok) redirect("/");

  return (
    <FeriadosPage
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
        />
      }
      conteudo={<FeriadosContainer feriados={feriados.value} />}
    />
  );
}
