import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { FilaDoSetorPage } from "@/presentation/components/pages/fila-do-setor.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { FilaContainer } from "@/modules/atendimento/presentation/view-models/fila/fila.container";
import { carregarFila } from "@/modules/atendimento/presentation/view-models/fila/fila.server";
import { SinoAvisosContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/sino-avisos.container";
import { ehSetor, SETORES } from "@/shared/kernel/setores";

export default async function Page() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");

  // Admin não pertence a um Setor: começa pelo primeiro e escolhe na tela.
  const ehAdmin = sessao.papel === "admin";
  const setor = ehAdmin ? SETORES[0] : sessao.setor;
  if (!ehSetor(setor)) redirect("/");
  const fila = await carregarFila(setor);
  if (!fila.ok) redirect("/");

  return (
    <FilaDoSetorPage
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
          avisos={<SinoAvisosContainer usuarioId={sessao.id} />}
        />
      }
      fila={
        <FilaContainer
          nome={sessao.nome}
          nivelDoTitulo={1}
          setorInicial={setor}
          initialData={fila.value}
          podeEscolherSetor={ehAdmin}
        />
      }
    />
  );
}
