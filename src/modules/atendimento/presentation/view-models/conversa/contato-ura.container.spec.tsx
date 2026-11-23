import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";

import { ContatoUraContainer } from "./contato-ura.container";
import { useContatoUra } from "./use-contato-ura.hook";
import { useConversa } from "./use-conversa.hook";

jest.mock("./use-contato-ura.hook", () => ({ useContatoUra: jest.fn() }));
jest.mock("./use-conversa.hook", () => ({ useConversa: jest.fn() }));

const aoAbrir = jest.fn();
const aoBuscar = jest.fn();
const props = { atendimentoId: "at-1", initialData: {} as ConversaVista };

function montar(etapa: "fechado" | "cliente") {
  jest.mocked(useConversa).mockReturnValue({
    conversa: {
      contatoUra: { pode: true, telefone: "(61) 98888-7777", cnpjSugerido: "11.444.777/0001-61" },
    },
  } as never);
  jest.mocked(useContatoUra).mockReturnValue({
    etapa,
    concluido: false,
    aviso: undefined,
    cliente: undefined,
    buscando: false,
    cadastrando: false,
    aoAbrir,
    aoBuscar,
    aoTrocarCliente: jest.fn(),
    aoCadastrar: jest.fn(),
    aoCancelar: jest.fn(),
  });
  render(<ContatoUraContainer {...props} />);
}

describe("ContatoUraContainer", () => {
  it("o botão abre o cadastro pelo hook", async () => {
    montar("fechado");
    await userEvent.click(
      screen.getByRole("button", { name: "Cadastrar como contato deste Cliente" }),
    );
    expect(aoAbrir).toHaveBeenCalledTimes(1);
  });

  it("leva o CNPJ sugerido pela URA ao campo e a busca ao hook", async () => {
    montar("cliente");
    expect(screen.getByLabelText(/CNPJ do Cliente/)).toHaveValue("11.444.777/0001-61");
    await userEvent.click(screen.getByRole("button", { name: "Buscar Cliente" }));
    expect(aoBuscar).toHaveBeenCalledWith("11.444.777/0001-61");
  });
});
