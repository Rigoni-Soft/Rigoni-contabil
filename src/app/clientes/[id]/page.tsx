import { redirect } from "next/navigation";

import { DadosBasicosDoCliente } from "@/presentation/components/organisms/dados-basicos-do-cliente.component";
import { EditarCadastroOperacionalPage } from "@/presentation/components/pages/editar-cadastro-operacional.page";
import { carregarSessao, validarSessao } from "@/presentation/view-models/shell/shell.server";
import { AnexarAlteracaoContratualContainer } from "@/modules/clientes/presentation/view-models/anexar-alteracao-contratual/anexar-alteracao-contratual.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { EditarCadastroOperacionalContainer } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.container";
import {
  carregarCadastroOperacionalCliente,
  carregarDadosBasicosCliente,
} from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.server";
import { ResponsavelDoSetorContainer } from "@/modules/clientes/presentation/view-models/responsavel-do-setor/responsavel-do-setor.container";
import { ondeAtribuirResponsavel } from "@/modules/clientes/presentation/view-models/responsavel-do-setor/responsavel-do-setor.presenter";
import { carregarResponsavelDoSetor } from "@/modules/clientes/presentation/view-models/responsavel-do-setor/responsavel-do-setor.server";
import { alteracaoEmFocoDaUrl } from "@/modules/clientes/presentation/view-models/visualizar-documento-contratual/documentos-contratuais.presenter";
import { carregarDocumentosContratuais } from "@/modules/clientes/presentation/view-models/visualizar-documento-contratual/visualizar-documento-contratual.server";
import { hrefSeguro } from "@/shared/kernel/href-seguro";
import {
  podeAnexarAlteracaoContratual,
  podeAtribuirResponsavel,
  podeEditarCadastroOperacional,
  soLeDadosBasicosDoCliente,
} from "@/shared/kernel/papeis";
import { REGIME_LABEL } from "@/shared/kernel/regimes";
import { ehSetor, SETOR_LABEL } from "@/shared/kernel/setores";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltarPara?: string; alteracao?: string | string[] }>;
};

function tituloDaPagina(soDadosBasicos: boolean, readOnly: boolean) {
  if (soDadosBasicos) return "Dados do cliente";
  return readOnly ? "Visualizar cadastro operacional" : "Editar cadastro operacional";
}

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const { voltarPara, alteracao } = await searchParams;
  const sessao = validarSessao(await carregarSessao());
  // O RH só lê os dados básicos: nem o cadastro operacional nem os documentos chegam ao servidor da página.
  const soDadosBasicos = soLeDadosBasicosDoCliente(sessao.papel, sessao.setor);
  const [basicos, resultado, documentos] = await Promise.all([
    soDadosBasicos ? carregarDadosBasicosCliente(id) : null,
    soDadosBasicos ? null : carregarCadastroOperacionalCliente(id),
    soDadosBasicos ? null : carregarDocumentosContratuais(id),
  ]);
  const carregado = basicos ?? resultado;
  if (!carregado?.ok || !carregado.value) redirect("/");

  // Só Admin ou Funcionário do setor Simples Nacional edita — qualquer outro
  // perfil autenticado só visualiza.
  // O SN atribui no próprio cadastro; o Líder dos demais Setores, no bloco do Setor dele.
  const { noCadastro: atribuiNoCadastro, noSetor: atribuiNoSetor } = ondeAtribuirResponsavel(
    sessao.papel,
    sessao.setor,
  );
  const responsavelDoSetor = atribuiNoSetor ? await carregarResponsavelDoSetor(id) : null;
  const readOnly = !podeEditarCadastroOperacional(sessao.papel, sessao.setor);

  return (
    <EditarCadastroOperacionalPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      titulo={tituloDaPagina(soDadosBasicos, readOnly)}
      voltarHref={hrefSeguro(voltarPara)}
      alteracoesContratuais={
        podeAnexarAlteracaoContratual(sessao.papel) ? (
          <AnexarAlteracaoContratualContainer
            clienteId={id}
            documentosIniciais={documentos?.ok ? documentos.value : undefined}
          />
        ) : undefined
      }
      responsavelDoSetor={
        atribuiNoSetor && ehSetor(sessao.setor) && responsavelDoSetor?.ok ? (
          <ResponsavelDoSetorContainer
            clienteId={id}
            setorRotulo={SETOR_LABEL[sessao.setor]}
            atual={responsavelDoSetor.value}
          />
        ) : undefined
      }
      formulario={
        basicos?.ok && basicos.value ? (
          <DadosBasicosDoCliente
            empresa={basicos.value.empresa}
            cnpj={basicos.value.cnpj}
            regime={REGIME_LABEL[basicos.value.regime] ?? basicos.value.regime}
          />
        ) : resultado?.ok && resultado.value ? (
          <EditarCadastroOperacionalContainer
            dados={resultado.value}
            readOnly={readOnly}
            // Se a carga do servidor falhar, o botão se lê por action (com aviso e "Tentar novamente").
            documentosContratuais={documentos?.ok ? documentos.value : undefined}
            podeAnexar={podeAnexarAlteracaoContratual(sessao.papel)}
            // Vindo de aviso de alteração: o botão do documento abre aquela alteração, em destaque.
            alteracaoEmFoco={alteracaoEmFocoDaUrl(alteracao)}
            podeAtribuirResponsavel={
              atribuiNoCadastro && podeAtribuirResponsavel(sessao.papel, sessao.setor)
            }
            aoSalvar={{ tipo: "voltar", href: hrefSeguro(voltarPara) }}
          />
        ) : undefined
      }
    />
  );
}
