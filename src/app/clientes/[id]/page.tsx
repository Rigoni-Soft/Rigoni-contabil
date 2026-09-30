import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { EditarCadastroOperacionalPage } from "@/presentation/components/pages/editar-cadastro-operacional.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { EditarCadastroOperacionalContainer } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.container";
import { carregarCadastroOperacionalCliente } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.server";
import { podeEditarCadastroOperacional } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/pode-editar-cadastro-operacional";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  const [sessao, resultado] = await Promise.all([
    carregarSessao(),
    carregarCadastroOperacionalCliente(id),
  ]);
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");
  if (!resultado.ok) redirect("/");

  // Só Admin ou Funcionário do setor Simples Nacional edita — qualquer outro
  // perfil autenticado só visualiza (critério de aceite do #34).
  const readOnly = !podeEditarCadastroOperacional(sessao.papel, sessao.setor);

  return (
    <EditarCadastroOperacionalPage
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
        />
      }
      titulo={readOnly ? "Visualizar cadastro operacional" : "Editar cadastro operacional"}
      formulario={
        <EditarCadastroOperacionalContainer dados={resultado.value} readOnly={readOnly} />
      }
    />
  );
}
