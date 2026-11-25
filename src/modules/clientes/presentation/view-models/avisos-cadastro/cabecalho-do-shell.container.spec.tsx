import { render, screen } from "@testing-library/react";

import { CabecalhoDoShellContainer } from "./cabecalho-do-shell.container";

jest.mock("@/presentation/view-models/shell/logout-button.container", () => ({
  LogoutButtonContainer: () => <button>Sair</button>,
}));
jest.mock("./sino-avisos.container", () => ({
  SinoAvisosContainer: () => <button>Avisos</button>,
}));

const sessao = { id: "u1", nome: "Jéssica", papel: "funcionario", setor: "simples_nacional" };

describe("CabecalhoDoShellContainer", () => {
  it("mostra o avatar-link para o início", () => {
    render(<CabecalhoDoShellContainer sessao={{ ...sessao, precisaTrocarSenha: false }} />);

    expect(screen.getByRole("link", { name: "Ir para o início" })).toHaveAttribute("href", "/");
  });

  it("com a troca obrigatória de senha pendente, sai sem avatar", () => {
    render(<CabecalhoDoShellContainer sessao={{ ...sessao, precisaTrocarSenha: true }} />);

    expect(screen.queryByRole("link", { name: "Ir para o início" })).not.toBeInTheDocument();
  });
});
