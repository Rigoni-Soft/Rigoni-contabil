import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { EditarCadastroOperacionalPage } from "@/presentation/components/pages/editar-cadastro-operacional.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { EditarCadastroOperacionalContainer } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.container";
import { carregarCadastroOperacionalCliente } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.server";
import { podeAtribuirResponsavel, podeEditarCadastroOperacional } from "@/shared/kernel/papeis";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltarPara?: string }>;
};

// Só aceita caminho relativo do próprio site — nunca repassar o parâmetro de
// query direto pro href (open redirect: "//evil.com", "https://evil.com" etc.).
function voltarHrefSeguro(valor: string | undefined): string {
  if (valor && valor.startsWith("/") && !valor.startsWith("//") && !valor.includes("://")) {
    return valor;
  }
  return "/";
}

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const { voltarPara } = await searchParams;
  const [sessao, resultado] = await Promise.all([
    carregarSessao(),
    carregarCadastroOperacionalCliente(id),
  ]);
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");
  if (!resultado.ok || !resultado.value) redirect("/");

  // Só Admin ou Funcionário do setor Simples Nacional edita — qualquer outro
  // perfil autenticado só visualiza.
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
      voltarHref={voltarHrefSeguro(voltarPara)}
      formulario={
        <EditarCadastroOperacionalContainer
          dados={resultado.value}
          readOnly={readOnly}
          podeAtribuirResponsavel={podeAtribuirResponsavel(sessao.papel, sessao.setor)}
          voltarHrefAoSalvar={voltarHrefSeguro(voltarPara)}
        />
      }
    />
  );
}
