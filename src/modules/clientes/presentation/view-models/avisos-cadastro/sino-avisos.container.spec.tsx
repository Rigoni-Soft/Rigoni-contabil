import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SinoAvisosContainer } from "./sino-avisos.container";

const aoAbrir = jest.fn();
const aoSelecionar = jest.fn();
const AVISO = {
  id: "a1",
  titulo: "Novo Cliente no Cadastro operacional",
  quando: "22/10/2026, 12:30",
  visto: false,
  href: "/clientes/c1",
};

jest.mock("./use-sino-avisos.hook", () => ({
  useSinoAvisos: () => ({
    contador: 2,
    avisos: [AVISO],
    estado: "pronto",
    temMais: false,
    carregandoMais: false,
    aoAbrir,
    aoSelecionar,
    aoCarregarMais: jest.fn(),
    aoTentarDeNovo: jest.fn(),
  }),
}));

describe("SinoAvisosContainer", () => {
  it("entrega à View o que o hook devolve e liga as ações do usuário ao hook", async () => {
    render(<SinoAvisosContainer />);

    expect(screen.getByTestId("selo-avisos")).toHaveTextContent("2");
    await userEvent.click(screen.getByRole("button", { name: /Avisos de cadastro, 2/ }));
    expect(aoAbrir).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: /Novo Cliente/ }));
    expect(aoSelecionar).toHaveBeenCalledWith(AVISO);
  });
});
