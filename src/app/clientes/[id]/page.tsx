import { redirect } from "next/navigation";

import { DadosBasicosDoCliente } from "@/presentation/components/molecules/dados-basicos-do-cliente.component";
import { FalhaDeCarga } from "@/presentation/components/molecules/falha-de-carga.component";
import { EditarCadastroOperacionalPage } from "@/presentation/components/pages/editar-cadastro-operacional.page";
import { carregarSessao, validarSessao } from "@/presentation/view-models/shell/shell.server";
import { AnexarAlteracaoContratualContainer } from "@/modules/clientes/presentation/view-models/anexar-alteracao-contratual/anexar-alteracao-contratual.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { EditarCadastroOperacionalContainer } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.container";
import { carregarClienteParaPagina } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.server";
import { ResponsavelDoSetorContainer } from "@/modules/clientes/presentation/view-models/responsavel-do-setor/responsavel-do-setor.container";
import { ondeAtribuirResponsavel } from "@/modules/clientes/presentation/view-models/responsavel-do-setor/responsavel-do-setor.presenter";
import { carregarResponsavelDoSetor } from "@/modules/clientes/presentation/view-models/responsavel-do-setor/responsavel-do-setor.server";
import { AcompanhamentoDoClienteContainer } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-do-cliente.container";
import {
  linksDoMes,
  rotuloDaCompetencia,
  servicosDoCliente,
} from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";
import { carregarAcompanhamentoMensal } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.server";
import { alteracaoEmFocoDaUrl } from "@/modules/clientes/presentation/view-models/visualizar-documento-contratual/documentos-contratuais.presenter";
import { hrefSeguro } from "@/shared/kernel/href-seguro";
import { mesAtual } from "@/shared/kernel/mes-atual";
import {
  podeAnexarAlteracaoContratual,
  podeAtribuirResponsavel,
  podeEditarCadastroOperacional,
  podeVerAcompanhamentoRh,
  soLeDadosBasicosDoCliente,
} from "@/shared/kernel/papeis";
import { ehSetor, SETOR_LABEL } from "@/shared/kernel/setores";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltarPara?: string; alteracao?: string | string[]; mes?: string }>;
};

type CargaDoCliente = Awaited<ReturnType<typeof carregarClienteParaPagina>>;

function montarFormulario(
  { basicos, operacional, documentos }: CargaDoCliente,
  sessao: { papel: string; setor: string },
  opcoes: {
    readOnly: boolean;
    atribuiNoCadastro: boolean;
    voltarPara?: string;
    alteracao?: string | string[];
  },
) {
  if (basicos?.ok && basicos.value) return <DadosBasicosDoCliente {...basicos.value} />;
  if (!operacional?.ok || !operacional.value) return undefined;
  return (
    <EditarCadastroOperacionalContainer
      dados={operacional.value}
      readOnly={opcoes.readOnly}
      // Se a carga do servidor falhar, o botão se lê por action (com aviso e "Tentar novamente").
      documentosContratuais={documentos?.ok ? documentos.value : undefined}
      podeAnexar={podeAnexarAlteracaoContratual(sessao.papel)}
      // Vindo de aviso de alteração: o botão do documento abre aquela alteração, em destaque.
      alteracaoEmFoco={alteracaoEmFocoDaUrl(opcoes.alteracao)}
      podeAtribuirResponsavel={
        opcoes.atribuiNoCadastro && podeAtribuirResponsavel(sessao.papel, sessao.setor)
      }
      aoSalvar={{ tipo: "voltar", href: hrefSeguro(opcoes.voltarPara) }}
    />
  );
}

// O acompanhamento do mês do RH, no painel do Cliente (como o DAS no do SN). Some quando o Cliente não
// está na vista do ator ou o mês é inválido; o resto da tela não depende dele.
// ponytail: lê a carteira do RH inteira para achar este Cliente; filtrar por cliente no repositório se pesar.
async function acompanhamentoRhDoCliente(
  clienteId: string,
  sessao: { papel: string; setor: string },
  mes: string | undefined,
  voltarPara: string | undefined,
) {
  if (!podeVerAcompanhamentoRh(sessao.papel, sessao.setor)) return undefined;
  const acompanhamento = await carregarAcompanhamentoMensal(mes);
  if (!acompanhamento.ok) return undefined;
  const servicos = servicosDoCliente(acompanhamento.value, clienteId);
  if (!servicos) return undefined;

  const { competencia } = acompanhamento.value;
  return (
    <AcompanhamentoDoClienteContainer
      clienteId={clienteId}
      competencia={competencia}
      rotuloCompetencia={rotuloDaCompetencia(competencia)}
      {...linksDoMes(clienteId, competencia, mesAtual(), voltarPara)}
      servicos={servicos}
    />
  );
}

function tituloDaPagina(soDadosBasicos: boolean, readOnly: boolean) {
  if (soDadosBasicos) return "Dados do cliente";
  return readOnly ? "Visualizar cadastro operacional" : "Editar cadastro operacional";
}

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const { voltarPara, alteracao, mes } = await searchParams;
  const sessao = validarSessao(await carregarSessao());
  const soDadosBasicos = soLeDadosBasicosDoCliente(sessao.papel, sessao.setor);
  const carga = await carregarClienteParaPagina(id, sessao.papel, sessao.setor);
  const { basicos, operacional, documentos } = carga;
  const carregado = basicos ?? operacional;
  // Falha de leitura não é Cliente inexistente: só este segundo volta ao início.
  if (carregado && !carregado.ok) {
    return (
      <EditarCadastroOperacionalPage
        header={<CabecalhoDoShellContainer sessao={sessao} />}
        titulo="Não foi possível carregar o cliente"
        voltarHref={hrefSeguro(voltarPara)}
        formulario={
          <FalhaDeCarga
            texto="Houve um erro ao ler os dados. Tente novamente."
            tentarNovamenteHref={`/clientes/${encodeURIComponent(id)}${
              voltarPara ? `?voltarPara=${encodeURIComponent(voltarPara)}` : ""
            }`}
          />
        }
      />
    );
  }
  if (!carregado?.value) redirect("/");

  // Só Admin ou Funcionário do setor Simples Nacional edita — qualquer outro
  // perfil autenticado só visualiza.
  // O SN atribui no próprio cadastro; o Líder dos demais Setores, no bloco do Setor dele.
  const { noCadastro: atribuiNoCadastro, noSetor: atribuiNoSetor } = ondeAtribuirResponsavel(
    sessao.papel,
    sessao.setor,
  );
  const responsavelDoSetor = atribuiNoSetor ? await carregarResponsavelDoSetor(id) : null;
  const readOnly = !podeEditarCadastroOperacional(sessao.papel, sessao.setor);
  const acompanhamentoRh = await acompanhamentoRhDoCliente(id, sessao, mes, voltarPara);

  const formulario = montarFormulario(carga, sessao, {
    readOnly,
    atribuiNoCadastro,
    voltarPara,
    alteracao,
  });

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
      acompanhamentoRh={acompanhamentoRh}
      formulario={formulario}
    />
  );
}
