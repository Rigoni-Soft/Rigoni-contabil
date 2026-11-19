import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as renderRtl, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { cadastroOperacionalDeTeste } from "../../../../../../test-support/cadastro-de-teste";
import { editarCadastroOperacionalAction } from "./editar-cadastro-operacional.actions";
import { EditarCadastroOperacionalContainer } from "./editar-cadastro-operacional.container";

// Passa a chamada adiante (a action real roda sobre o `executeMock`); só registra o que ela recebeu.
jest.mock("./editar-cadastro-operacional.actions", () => {
  const real = jest.requireActual("./editar-cadastro-operacional.actions");
  return {
    ...real,
    editarCadastroOperacionalAction: jest.fn(real.editarCadastroOperacionalAction),
  };
});

const routerPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: jest.fn() }),
}));

const executeMock = jest.fn();

const atribuirMock = jest.fn();
const listarMock = jest.fn();
const salvarContatoMock = jest.fn();
const definirTiposMock = jest.fn();
jest.mock("@/main/clientes.factory", () => ({
  makeSalvarContatoDoCliente: () => ({ execute: salvarContatoMock }),
  makeDefinirTiposDeEnvioDoContato: () => ({ execute: definirTiposMock }),
  makeEditarCadastroOperacionalCliente: () => ({ execute: executeMock }),
  makeAtribuirResponsavelCliente: () => ({ execute: atribuirMock }),
  makeListarResponsaveisElegiveis: () => ({ execute: listarMock }),
  makeListarDocumentosContratuaisCliente: () => ({
    execute: async () => ok([]),
  }),
  makeObterLinkDocumentoContratual: () => ({ execute: jest.fn() }),
}));

// O Admin só cadastra contatos (sem Setor, não define destinos): os testes de contatos e do resto do cadastro.
const ADMIN = { papel: "admin", setor: "administrativo" };

const dados: CadastroOperacionalClienteDto = cadastroOperacionalDeTeste({
  contatos: [{ id: "c1", nome: "Maria", telefone: "11999990000", email: "" }],
  documentoObrigatorio: "positivo",
  dasStatus: "pronto",
  observacoesGerais: "Cliente pontual.",
  atividadeMes: { industria: false, comercio: true, servico: false },
});

// Sem retry: o backoff do React Query travaria os findBy.
function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderRtl(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("EditarCadastroOperacionalContainer", () => {
  beforeEach(() => {
    executeMock.mockReset();
    salvarContatoMock.mockReset();
    atribuirMock.mockReset();
    listarMock.mockReset();
    listarMock.mockResolvedValue(
      ok([{ id: "f1111111-1111-4111-8111-111111111111", nome: "Funcionário SN" }]),
    );
    routerPush.mockReset();
  });

  it.each([
    ["lucro_presumido", "Lucro Presumido"],
    ["lucro_real", "Lucro Real"],
  ])("Regime %s: avisa que não se aplica e não renderiza o formulário", (regime, rotulo) => {
    render(
      <EditarCadastroOperacionalContainer
        dados={{ ...dados, regime }}
        ator={ADMIN}
        readOnly={false}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(`não se aplica ao Regime ${rotulo}`);
    expect(screen.queryByRole("button", { name: /salvar/i })).not.toBeInTheDocument();
  });

  it.each(["lucro_presumido", "lucro_real"])(
    "Regime %s: Admin ainda tem como anexar a alteração contratual",
    (regime) => {
      render(
        <EditarCadastroOperacionalContainer
          dados={{ ...dados, regime }}
          ator={ADMIN}
          readOnly={false}
          documentosContratuais={[]}
          podeAnexar
        />,
      );

      expect(screen.getByRole("button", { name: /anexar/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /salvar/i })).not.toBeInTheDocument();
    },
  );

  it("Responsável: sem permissão mostra o nome (campo desabilitado); Líder escolhe e salva via atribuir", async () => {
    const { unmount } = render(
      <EditarCadastroOperacionalContainer dados={dados} ator={ADMIN} readOnly={false} />,
    );
    expect(screen.getByLabelText("Responsável")).toBeDisabled();
    expect(screen.getByLabelText("Responsável")).toHaveValue("Sem responsável");
    unmount();

    executeMock.mockResolvedValue(ok({ clienteId: dados.id }));
    atribuirMock.mockResolvedValue(ok({ clienteId: dados.id }));
    render(
      <EditarCadastroOperacionalContainer
        dados={dados}
        ator={ADMIN}
        readOnly={false}
        podeAtribuirResponsavel
        aoSalvar={{ tipo: "voltar", href: "/simples-nacional" }}
      />,
    );
    // Lista só é buscada quando o Select recebe foco/abre.
    expect(listarMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText("Responsável"));
    await screen.findByRole("option", { name: "Funcionário SN" });
    expect(listarMock).toHaveBeenCalledTimes(1);
    await userEvent.selectOptions(
      screen.getByLabelText("Responsável"),
      "f1111111-1111-4111-8111-111111111111",
    );
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(atribuirMock).toHaveBeenCalledWith({
        clienteId: dados.id,
        responsavelId: "f1111111-1111-4111-8111-111111111111",
      }),
    );
    expect(routerPush).toHaveBeenCalledWith("/simples-nacional");
  });

  it("Responsável: falha ao carregar a lista mostra aviso com Tentar de novo, que busca de novo", async () => {
    listarMock.mockResolvedValueOnce(err(new ForbiddenError("falhou")));
    render(
      <EditarCadastroOperacionalContainer
        dados={dados}
        ator={ADMIN}
        readOnly={false}
        podeAtribuirResponsavel
      />,
    );

    await userEvent.click(screen.getByLabelText("Responsável"));
    expect(await screen.findByText(/Não foi possível carregar a lista/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByRole("option", { name: "Funcionário SN" })).toBeInTheDocument();
    expect(listarMock).toHaveBeenCalledTimes(2);
  });

  it("Responsável: erro ao atribuir mostra a mensagem e não navega", async () => {
    executeMock.mockResolvedValue(ok({ clienteId: dados.id }));
    atribuirMock.mockResolvedValue(err(new ForbiddenError("Só o Líder atribui.")));
    render(
      <EditarCadastroOperacionalContainer
        dados={dados}
        ator={ADMIN}
        readOnly={false}
        podeAtribuirResponsavel
        aoSalvar={{ tipo: "voltar", href: "/simples-nacional" }}
      />,
    );
    await userEvent.click(screen.getByLabelText("Responsável"));
    await screen.findByRole("option", { name: "Funcionário SN" });
    await userEvent.selectOptions(
      screen.getByLabelText("Responsável"),
      "f1111111-1111-4111-8111-111111111111",
    );
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(/Os dados foram salvos, mas não foi possível atribuir/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Só o Líder atribui./)).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
  });

  describe("retry depois de salvar o cadastro e falhar só a atribuição", () => {
    async function falharAtribuicao() {
      executeMock.mockResolvedValue(ok({ clienteId: dados.id }));
      atribuirMock.mockResolvedValueOnce(err(new ForbiddenError("Só o Líder atribui.")));
      render(
        <EditarCadastroOperacionalContainer
          dados={dados}
          ator={ADMIN}
          readOnly={false}
          podeAtribuirResponsavel
          aoSalvar={{ tipo: "voltar", href: "/simples-nacional" }}
        />,
      );
      await userEvent.click(screen.getByLabelText("Responsável"));
      await screen.findByRole("option", { name: "Funcionário SN" });
      await userEvent.selectOptions(
        screen.getByLabelText("Responsável"),
        "f1111111-1111-4111-8111-111111111111",
      );
      await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
      await screen.findByText(/Os dados foram salvos, mas não foi possível atribuir/);
    }

    it("o segundo clique repete só a atribuição, sem chamar a edição de novo", async () => {
      await falharAtribuicao();
      atribuirMock.mockResolvedValue(ok(undefined));

      await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

      await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/simples-nacional"));
      expect(executeMock).toHaveBeenCalledTimes(1);
      expect(atribuirMock).toHaveBeenCalledTimes(2);
    });

    it("atribuição que rejeita por transporte também não faz o segundo clique regravar o cadastro", async () => {
      executeMock.mockResolvedValue(ok({ clienteId: dados.id }));
      atribuirMock.mockRejectedValueOnce(new Error("rede"));
      render(
        <EditarCadastroOperacionalContainer
          dados={dados}
          ator={ADMIN}
          readOnly={false}
          podeAtribuirResponsavel
          aoSalvar={{ tipo: "voltar", href: "/simples-nacional" }}
        />,
      );
      await userEvent.click(screen.getByLabelText("Responsável"));
      await screen.findByRole("option", { name: "Funcionário SN" });
      await userEvent.selectOptions(
        screen.getByLabelText("Responsável"),
        "f1111111-1111-4111-8111-111111111111",
      );
      await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
      expect(
        await screen.findByText(/Os dados foram salvos, mas não foi possível atribuir/),
      ).toBeInTheDocument();
      atribuirMock.mockResolvedValue(ok(undefined));

      await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

      await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/simples-nacional"));
      expect(executeMock).toHaveBeenCalledTimes(1);
      expect(atribuirMock).toHaveBeenCalledTimes(2);
    });

    it("se outro campo mudou entre as tentativas, o salvamento completo volta", async () => {
      await falharAtribuicao();
      atribuirMock.mockResolvedValue(ok(undefined));

      await userEvent.type(screen.getByLabelText(/observações gerais/i), " Mais um detalhe.");
      await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

      await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/simples-nacional"));
      expect(executeMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("alteração do aviso no cartão do documento (#144)", () => {
    const documentos = [
      { tipo: "alteracao" as const, numero: 2, data: "2025-03-05", arquivo: "2-a.pdf" },
      { tipo: "alteracao" as const, numero: 1, data: "2024-01-10", arquivo: "1-a.pdf" },
      { tipo: "contrato" as const, numero: null, data: null, arquivo: "contrato.pdf" },
    ];

    it.each([
      ["no formulário do Simples Nacional", "simples_nacional"],
      ["fora do Simples Nacional (só o documento)", "lucro_presumido"],
    ])("%s: com o nº do aviso, abre aquela alteração com o botão em foco", (_, regime) => {
      render(
        <EditarCadastroOperacionalContainer
          dados={{ ...dados, regime }}
          ator={ADMIN}
          readOnly={false}
          documentosContratuais={documentos}
          alteracaoEmFoco={1}
        />,
      );

      const botao = screen.getByRole("button", {
        name: "Abrir em nova aba: Alteração nº 1 - 10/01/2024",
      });
      expect(botao).toHaveFocus();
    });
  });

  it("modo readOnly: nunca renderiza contrato social/alterações e não mostra Salvar/Limpar/Cancelar", () => {
    render(<EditarCadastroOperacionalContainer dados={dados} ator={ADMIN} readOnly />);

    expect(screen.queryByText(/contrato social/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/alteraç(ão|ões) contratua/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /salvar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /limpar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /cancelar/i })).not.toBeInTheDocument();
  });

  it("modo edição: campos ficam habilitados e os botões Salvar/Limpar/Cancelar aparecem", () => {
    render(<EditarCadastroOperacionalContainer dados={dados} ator={ADMIN} readOnly={false} />);

    expect(screen.getByLabelText(/documento recebido/i)).toBeEnabled();
    expect(screen.queryByLabelText(/forma de envio/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /limpar/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cancelar/i })).toHaveAttribute("href", "/");
  });

  describe("o que cada contato recebe do Setor", () => {
    const FUNCIONARIO_SN = { papel: "funcionario", setor: "simples_nacional" };
    // A action valida o id como UUID antes de chamar o caso de uso.
    const PAULO_ID = "22222222-2222-4222-8222-222222222222";
    const MARIA_ID = "11111111-1111-4111-8111-111111111111";
    const dadosComEnvios: CadastroOperacionalClienteDto = {
      ...dados,
      contatos: [
        {
          id: MARIA_ID,
          nome: "Maria",
          telefone: "11999990000",
          email: "",
          donoSetor: "simples_nacional",
        },
        {
          id: PAULO_ID,
          nome: "Paulo",
          telefone: "",
          email: "paulo@exemplo.com",
          donoSetor: "rh",
          setores: ["simples_nacional"],
        },
      ],
      tiposDeEnvio: [
        { slug: "das", rotulo: "DAS" },
        { slug: "avisos", rotulo: "Avisos" },
      ],
      destinos: [{ id: "d1", contatoId: MARIA_ID, tipo: "das", canal: "whatsapp" }],
    };

    beforeEach(() => {
      definirTiposMock.mockReset();
      salvarContatoMock.mockReset();
    });

    const abrir = (ator = FUNCIONARIO_SN) =>
      render(
        <EditarCadastroOperacionalContainer dados={dadosComEnvios} ator={ator} readOnly={false} />,
      );

    it("cada contato mostra, só em leitura, o que já recebe; Editar e lixeira ficam na linha do dono", () => {
      abrir();

      const maria = screen.getByRole("group", { name: "Envios do contato 1" });
      expect(within(maria).getByLabelText("DAS")).toBeChecked();
      expect(within(maria).getByLabelText("DAS")).toBeDisabled();
      expect(within(maria).getByLabelText("Avisos")).not.toBeChecked();
      expect(screen.getByRole("button", { name: "Editar contato 1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remover contato 1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Adicionar contato" })).toBeInTheDocument();
      expect(screen.queryByText("Destinos de envio")).toBeNull();
    });

    it("contato de outro Setor: campos só de leitura, lixeira só deixa de usar; o Setor edita os envios dele", async () => {
      definirTiposMock.mockResolvedValue(ok(undefined));
      const usuario = userEvent.setup();
      abrir();

      expect(screen.queryByRole("button", { name: "Remover contato 2" })).toBeNull();
      await usuario.click(screen.getByRole("button", { name: "Editar contato 2" }));
      const nomes = screen.getAllByLabelText(/^Nome/, { selector: "input[id^='contatos.']" });
      expect(nomes[1]).toHaveAttribute("readonly");
      const paulo = screen.getByRole("group", { name: "Envios do contato 2" });
      await usuario.click(within(paulo).getByLabelText("Avisos"));
      await usuario.click(screen.getByRole("button", { name: "Salvar contato 2" }));

      await waitFor(() =>
        expect(definirTiposMock).toHaveBeenCalledWith({
          clienteId: dados.id,
          contatoId: PAULO_ID,
          tipos: ["avisos"],
        }),
      );
      expect(salvarContatoMock).not.toHaveBeenCalled();
      expect(await screen.findByRole("button", { name: "Editar contato 2" })).toBeInTheDocument();
      expect(within(paulo).getByLabelText("Avisos")).toBeChecked();
    });

    it("contato com os dois canais: pede por onde enviar e grava com o canal escolhido", async () => {
      definirTiposMock.mockResolvedValue(ok(undefined));
      const RITA_ID = "33333333-3333-4333-8333-333333333333";
      const usuario = userEvent.setup();
      render(
        <EditarCadastroOperacionalContainer
          dados={{
            ...dadosComEnvios,
            contatos: [
              {
                id: RITA_ID,
                nome: "Rita",
                telefone: "11999991111",
                email: "rita@exemplo.com",
                donoSetor: "simples_nacional",
              },
            ],
            destinos: [],
          }}
          ator={FUNCIONARIO_SN}
          readOnly={false}
        />,
      );

      await usuario.click(screen.getByRole("button", { name: "Editar contato 1" }));
      const rita = screen.getByRole("group", { name: "Envios do contato 1" });
      expect(screen.queryByLabelText(/^Enviar por/)).toBeNull();
      await usuario.click(within(rita).getByLabelText("Avisos"));
      await usuario.click(screen.getByRole("button", { name: "Salvar contato 1" }));

      expect(
        await screen.findByText("Escolha por onde enviar a este contato."),
      ).toBeInTheDocument();
      expect(definirTiposMock).not.toHaveBeenCalled();
      await usuario.selectOptions(screen.getByLabelText(/^Enviar por/), "E-mail");
      await usuario.click(screen.getByRole("button", { name: "Salvar contato 1" }));

      await waitFor(() =>
        expect(definirTiposMock).toHaveBeenCalledWith({
          clienteId: dados.id,
          contatoId: RITA_ID,
          tipos: ["avisos"],
          canal: "email",
        }),
      );
      expect(await screen.findByText(/Enviar por:\s*E-mail/)).toBeInTheDocument();
    });

    it("linha nova: o número digitado que já é de um contato do Cliente avisa ao sair do campo, e 'Usar este contato' o escolhe", async () => {
      const usuario = userEvent.setup();
      const BIA_ID = "33333333-3333-4333-8333-333333333333";
      render(
        <EditarCadastroOperacionalContainer
          dados={{
            ...dadosComEnvios,
            contatos: [
              ...dadosComEnvios.contatos,
              {
                id: BIA_ID,
                nome: "Bia",
                telefone: "11977770000",
                email: "",
                donoSetor: "rh",
              },
            ],
          }}
          ator={FUNCIONARIO_SN}
          readOnly={false}
        />,
      );

      await usuario.click(screen.getByRole("button", { name: "Adicionar contato" }));
      await usuario.selectOptions(screen.getByLabelText(/^Nome/, { selector: "select" }), [
        "__novo__",
      ]);
      const telefone = screen.getAllByLabelText("WhatsApp").at(-1) as HTMLElement;
      await usuario.type(telefone, "11999990000");
      await usuario.tab();
      expect(
        screen.getByText("Este número já é do contato Maria, que já está na lista deste Setor."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Usar este contato" })).toBeNull();

      await usuario.clear(telefone);
      await usuario.type(telefone, "11977770000");
      await usuario.tab();
      expect(screen.getByText("Este número já é do contato Bia.")).toBeInTheDocument();
      await usuario.click(screen.getByRole("button", { name: "Usar este contato" }));

      expect(await screen.findByRole("group", { name: "Envios do contato 3" })).toBeInTheDocument();
      expect(screen.queryByText("Este número já é do contato Bia.")).toBeNull();
    });

    it("editar o contato do Setor grava o contato e os envios juntos no Salvar da linha", async () => {
      salvarContatoMock.mockResolvedValue({ ok: true, value: { id: MARIA_ID } });
      definirTiposMock.mockResolvedValue(ok(undefined));
      const usuario = userEvent.setup();
      abrir();

      await usuario.click(screen.getByRole("button", { name: "Editar contato 1" }));
      await usuario.type(screen.getAllByLabelText(/^Nome/)[0], " Silva");
      await usuario.click(
        within(screen.getByRole("group", { name: "Envios do contato 1" })).getByLabelText(
          "Todos os envios",
        ),
      );
      await usuario.click(screen.getByRole("button", { name: "Salvar contato 1" }));

      await waitFor(() =>
        expect(definirTiposMock).toHaveBeenCalledWith({
          clienteId: dados.id,
          contatoId: MARIA_ID,
          tipos: ["todos", "das", "avisos"],
        }),
      );
      expect(salvarContatoMock).toHaveBeenCalledWith(
        expect.objectContaining({
          contato: expect.objectContaining({ id: MARIA_ID, nome: "Maria Silva" }),
        }),
      );
    });

    it("Cancelar desfaz o que se marcou e não chama o servidor", async () => {
      const usuario = userEvent.setup();
      abrir();

      await usuario.click(screen.getByRole("button", { name: "Editar contato 1" }));
      const maria = screen.getByRole("group", { name: "Envios do contato 1" });
      await usuario.click(within(maria).getByLabelText("Avisos"));
      expect(within(maria).getByLabelText("Todos os envios")).toBeChecked();
      await usuario.click(screen.getByRole("button", { name: "Cancelar edição do contato 1" }));

      expect(within(maria).getByLabelText("Avisos")).not.toBeChecked();
      expect(within(maria).getByLabelText("Todos os envios")).not.toBeChecked();
      expect(definirTiposMock).not.toHaveBeenCalled();
    });

    it("falha do servidor ao salvar os envios aparece na linha e ela segue em edição", async () => {
      definirTiposMock.mockResolvedValue(err(new ForbiddenError("Sem permissão.")));
      const usuario = userEvent.setup();
      abrir();

      await usuario.click(screen.getByRole("button", { name: "Editar contato 1" }));
      await usuario.click(
        within(screen.getByRole("group", { name: "Envios do contato 1" })).getByLabelText("DAS"),
      );
      await usuario.click(screen.getByRole("button", { name: "Salvar contato 1" }));

      expect(await screen.findByText("Sem permissão.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Salvar contato 1" })).toBeInTheDocument();
    });

    it("linha em edição segura o Salvar do cadastro, com o motivo", async () => {
      const usuario = userEvent.setup();
      abrir();

      await usuario.click(screen.getByRole("button", { name: "Editar contato 1" }));

      expect(screen.getByRole("button", { name: /^Salvar$/ })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(
        screen.getByText("Salve ou cancele a edição do contato 1 para salvar o cadastro."),
      ).toBeInTheDocument();
    });

    it("avisa quando o contato deixou de ter o canal que o envio usa", async () => {
      const usuario = userEvent.setup();
      abrir();

      await usuario.click(screen.getByRole("button", { name: "Editar contato 1" }));
      await usuario.clear(screen.getAllByLabelText("WhatsApp")[0]);

      expect(await screen.findByText(/deixou de ter o WhatsApp/)).toBeInTheDocument();
    });

    it("o Admin edita e remove qualquer contato, sem checkboxes de envio", async () => {
      const usuario = userEvent.setup();
      abrir(ADMIN);

      expect(screen.queryByRole("group", { name: /Envios do contato/ })).toBeNull();
      expect(screen.getByRole("button", { name: "Remover contato 2" })).toBeInTheDocument();
      await usuario.click(screen.getByRole("button", { name: "Editar contato 2" }));
      const nomes = screen.getAllByLabelText(/^Nome/, { selector: "input[id^='contatos.']" });
      expect(nomes[1]).not.toHaveAttribute("readonly");
    });
  });

  it("DAS: 'Enviado' não é opção escolhível; a data de envio é sempre só leitura e desativada (#108)", () => {
    render(<EditarCadastroOperacionalContainer dados={dados} ator={ADMIN} readOnly={false} />);

    expect(screen.queryByRole("option", { name: "Enviado" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("DAS")).toBeEnabled();
    const data = screen.getByLabelText(/data de envio/i);
    expect(data).toHaveAttribute("readonly");
    expect(data).toBeDisabled();
  });

  it("DAS já enviado pelo sistema: 'Enviado' e a data aparecem, mas o campo DAS fica desativado", () => {
    render(
      <EditarCadastroOperacionalContainer
        dados={{ ...dados, dasStatus: "enviado", dataEnvioDas: "2026-10-05" }}
        ator={ADMIN}
        readOnly={false}
      />,
    );

    const das = screen.getByLabelText("DAS");
    expect(das).toHaveValue("enviado");
    expect(das).toBeDisabled();
    expect(screen.getByLabelText(/data de envio/i)).toHaveValue("2026-10-05");
    expect(screen.getByLabelText(/data de envio/i)).toBeDisabled();
  });

  it("modo readOnly não oferece adicionar nem remover contato", () => {
    render(<EditarCadastroOperacionalContainer dados={dados} ator={ADMIN} readOnly />);

    expect(screen.getByLabelText(/^Nome/, { selector: "input" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Adicionar contato" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remover contato/i })).not.toBeInTheDocument();
  });

  it("editando, adicionar e remover contato continuam disponíveis", () => {
    render(<EditarCadastroOperacionalContainer dados={dados} ator={ADMIN} readOnly={false} />);

    expect(screen.getByRole("button", { name: "Adicionar contato" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remover contato 1" })).toBeEnabled();
  });

  it("no HTML do servidor o formulário vem oculto até hidratar (sem placeholders no lugar dos valores)", () => {
    const client = new QueryClient();
    const html = renderToString(
      <QueryClientProvider client={client}>
        <EditarCadastroOperacionalContainer dados={dados} ator={ADMIN} readOnly={false} />
      </QueryClientProvider>,
    );

    const abertura = html.match(/<form[^>]*>/)?.[0] ?? "";
    expect(abertura).toContain("rc-oculto-ate-hidratar");
  });

  it("depois de hidratar, o formulário fica visível", () => {
    const { container } = render(
      <EditarCadastroOperacionalContainer dados={dados} ator={ADMIN} readOnly={false} />,
    );

    expect(container.querySelector("form")).not.toHaveClass("rc-oculto-ate-hidratar");
  });

  it("Empresa, CNPJ, Regime e Responsável têm rótulo ligado ao campo e estão desativados", () => {
    render(<EditarCadastroOperacionalContainer dados={dados} ator={ADMIN} readOnly={false} />);

    for (const [rotulo, valor] of [
      ["Empresa", "Padaria Pão Quente Ltda"],
      ["CNPJ", "11444777000161"],
      ["Regime", "Simples Nacional"],
      ["Responsável", "Sem responsável"],
    ]) {
      const campo = screen.getByLabelText(rotulo, { selector: "input" });
      expect(campo).toBeDisabled();
      expect(campo).toHaveValue(valor);
    }
  });

  it("explica por que a data de envio e o DAS enviado estão travados", () => {
    const { unmount } = render(
      <EditarCadastroOperacionalContainer dados={dados} ator={ADMIN} readOnly={false} />,
    );

    expect(screen.getByLabelText(/data de envio/i)).toHaveAccessibleDescription(
      "Preenchida pelo sistema quando o DAS é enviado.",
    );
    // DAS ainda editável: sem texto de "travado".
    expect(screen.getByLabelText("DAS")).not.toHaveAccessibleDescription();
    unmount();

    render(
      <EditarCadastroOperacionalContainer
        dados={{ ...dados, dasStatus: "enviado", dataEnvioDas: "2026-10-05" }}
        ator={ADMIN}
        readOnly={false}
      />,
    );
    expect(screen.getByLabelText("DAS")).toHaveAccessibleDescription("Definido pelo sistema.");
  });

  it("salvar com DAS já enviado mantém 'enviado' e a data no que vai ao servidor", async () => {
    executeMock.mockResolvedValue({ ok: true, value: { clienteId: dados.id } });
    const usuario = userEvent.setup();
    render(
      <EditarCadastroOperacionalContainer
        dados={{ ...dados, dasStatus: "enviado", dataEnvioDas: "2026-10-05" }}
        ator={ADMIN}
        readOnly={false}
      />,
    );

    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    await screen.findByText(/atualizado/i);
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ dasStatus: "enviado", dataEnvioDas: "2026-10-05" }),
    );
  });

  it("'Limpar' desfaz uma edição não salva, voltando ao valor carregado do servidor", async () => {
    const usuario = userEvent.setup();
    render(<EditarCadastroOperacionalContainer dados={dados} ator={ADMIN} readOnly={false} />);

    await usuario.clear(screen.getByLabelText(/observações gerais/i));
    await usuario.type(screen.getByLabelText(/observações gerais/i), "Rascunho não salvo.");
    await usuario.click(screen.getByRole("button", { name: /limpar/i }));

    expect(screen.getByLabelText(/observações gerais/i)).toHaveValue("Cliente pontual.");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("submete os dados editados e mostra confirmação", async () => {
    executeMock.mockResolvedValue({ ok: true, value: { clienteId: dados.id } });
    const usuario = userEvent.setup();
    render(<EditarCadastroOperacionalContainer dados={dados} ator={ADMIN} readOnly={false} />);

    await usuario.clear(screen.getByLabelText(/observações gerais/i));
    await usuario.type(screen.getByLabelText(/observações gerais/i), "Atualizado.");
    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/atualizado/i)).toBeInTheDocument();
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: dados.id, observacoesGerais: "Atualizado." }),
    );
  });

  it("a action do cadastro não recebe os Parcelamentos (os PDFs vão só pela action própria)", async () => {
    executeMock.mockResolvedValue({ ok: true, value: { clienteId: dados.id } });
    const comParcelamento = {
      ...dados,
      parcelamentos: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          codigo: "A-1",
          parcelasRestantes: 3,
          interno: false,
          quitado: false,
          temEnvio: false,
          enviadoNoMes: false,
          arquivoNome: "acordo.pdf",
        },
      ],
    } as CadastroOperacionalClienteDto;
    const usuario = userEvent.setup();
    render(
      <EditarCadastroOperacionalContainer dados={comParcelamento} ator={ADMIN} readOnly={false} />,
    );

    await usuario.clear(screen.getByLabelText(/observações gerais/i));
    await usuario.type(screen.getByLabelText(/observações gerais/i), "Atualizado.");
    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    await screen.findByText(/atualizado/i);
    const enviado = jest.mocked(editarCadastroOperacionalAction).mock.calls.at(-1)?.[0];
    expect(enviado).toBeDefined();
    expect(enviado).not.toHaveProperty("parcelamentos");
  });

  it("sem Contatos nem Parcelamentos abre com uma linha em branco de cada, que não impede salvar", async () => {
    executeMock.mockResolvedValue({ ok: true, value: { clienteId: dados.id } });
    const usuario = userEvent.setup();
    render(
      <EditarCadastroOperacionalContainer
        dados={{ ...dados, contatos: [], parcelamentos: [] }}
        ator={ADMIN}
        readOnly={false}
      />,
    );

    expect(screen.getByLabelText(/^nome/i)).toHaveValue("");
    expect(screen.getByLabelText(/código/i)).toHaveValue("");
    await usuario.click(screen.getByRole("button", { name: /^salvar$/i }));

    expect(await screen.findByText(/atualizado/i)).toBeInTheDocument();
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({ contatos: [] }));
  });

  it("linha de Contato preenchida pela metade acusa o erro na linha certa", async () => {
    const usuario = userEvent.setup();
    render(
      <EditarCadastroOperacionalContainer
        dados={{ ...dados, contatos: [] }}
        ator={ADMIN}
        readOnly={false}
      />,
    );

    await usuario.type(screen.getByLabelText(/^nome/i), "Maria");
    await usuario.click(screen.getByRole("button", { name: "Salvar contato 1" }));

    expect(await screen.findByText("Informe o WhatsApp ou o e-mail")).toBeInTheDocument();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("contato novo tem Salvar e Cancelar; Salvar grava só ele e a linha passa a ter a lixeira", async () => {
    salvarContatoMock.mockResolvedValue({ ok: true, value: { id: "novo-id" } });
    const usuario = userEvent.setup();
    render(
      <EditarCadastroOperacionalContainer
        dados={{ ...dados, contatos: [] }}
        ator={ADMIN}
        readOnly={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /remover contato/i })).not.toBeInTheDocument();
    await usuario.type(screen.getByLabelText(/^nome/i), "Joana");
    await usuario.type(screen.getByLabelText(/e-mail/i), "joana@exemplo.com");
    await usuario.click(screen.getByRole("button", { name: "Salvar contato 1" }));

    expect(await screen.findByRole("button", { name: "Remover contato 1" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^nome/i)).toHaveAttribute("readonly");
    expect(screen.getByText("Contato 1 salvo.")).toHaveAttribute("aria-live", "polite");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Editar contato 1" })).toHaveFocus(),
    );
    expect(screen.queryByRole("button", { name: "Salvar contato 1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar edição do contato 1" })).toBeNull();
    expect(salvarContatoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: dados.id,
        contato: expect.objectContaining({ nome: "Joana", email: "joana@exemplo.com" }),
      }),
    );
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("Salvar com a linha incompleta acusa o erro e não grava", async () => {
    const usuario = userEvent.setup();
    render(
      <EditarCadastroOperacionalContainer
        dados={{ ...dados, contatos: [] }}
        ator={ADMIN}
        readOnly={false}
      />,
    );

    await usuario.type(screen.getByLabelText(/^nome/i), "Joana");
    await usuario.click(screen.getByRole("button", { name: "Salvar contato 1" }));

    expect(await screen.findByText("Informe o WhatsApp ou o e-mail")).toBeInTheDocument();
    expect(salvarContatoMock).not.toHaveBeenCalled();
  });

  it("Cancelar na única linha nova a esvazia", async () => {
    const usuario = userEvent.setup();
    render(
      <EditarCadastroOperacionalContainer
        dados={{ ...dados, contatos: [] }}
        ator={ADMIN}
        readOnly={false}
      />,
    );

    await usuario.type(screen.getByLabelText(/^nome/i), "Joana");
    await usuario.type(screen.getByLabelText(/e-mail/i), "joana@exemplo.com");
    await usuario.click(screen.getByRole("button", { name: "Cancelar edição do contato 1" }));

    expect(screen.getByLabelText(/^nome/i)).toHaveValue("");
    expect(screen.getByLabelText(/e-mail/i)).toHaveValue("");
    expect(salvarContatoMock).not.toHaveBeenCalled();
  });

  it("Promise rejeitada da Server Action não prende o botão em 'Salvando…'", async () => {
    executeMock.mockRejectedValue(new Error("falha de rede"));
    const usuario = userEvent.setup();
    render(<EditarCadastroOperacionalContainer dados={dados} ator={ADMIN} readOnly={false} />);

    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/Não foi possível salvar agora/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /salvar/i })).toBeEnabled();
  });

  // Tela própria (/clientes/[id]) navega de volta pro lugar certo depois de
  // salvar, em vez de ficar parada no form.
  it("com aoSalvar voltar, navega pra lá depois de salvar com sucesso", async () => {
    executeMock.mockResolvedValue({ ok: true, value: { clienteId: dados.id } });
    const usuario = userEvent.setup();
    render(
      <EditarCadastroOperacionalContainer
        dados={dados}
        ator={ADMIN}
        readOnly={false}
        aoSalvar={{ tipo: "voltar", href: "/clientes/resumo/sem_documento" }}
      />,
    );

    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    await screen.findByText(/atualizado/i);
    expect(routerPush).toHaveBeenCalledWith("/clientes/resumo/sem_documento");
  });

  // Painel embutido no dashboard (busca do /simples-nacional): quem decide o
  // "fechar/voltar" é o consumidor (fecha o painel + atualiza a página), não
  // uma navegação fixa — destino "fechar" chama o callback e nunca navega.
  it("com aoSalvar fechar, chama o callback em vez de navegar", async () => {
    executeMock.mockResolvedValue({ ok: true, value: { clienteId: dados.id } });
    const aoSalvarComSucesso = jest.fn();
    const usuario = userEvent.setup();
    render(
      <EditarCadastroOperacionalContainer
        dados={dados}
        ator={ADMIN}
        readOnly={false}
        aoSalvar={{ tipo: "fechar", executar: aoSalvarComSucesso }}
      />,
    );

    await usuario.click(screen.getByRole("button", { name: /salvar/i }));

    await screen.findByText(/atualizado/i);
    expect(aoSalvarComSucesso).toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("cliente não encontrado: mostra mensagem em vez do formulário", () => {
    render(<EditarCadastroOperacionalContainer dados={null} ator={ADMIN} readOnly={false} />);

    expect(screen.getByText(/cliente não encontrado/i)).toBeInTheDocument();
  });
});
