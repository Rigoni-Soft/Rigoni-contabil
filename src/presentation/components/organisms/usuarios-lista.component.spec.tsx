import { render, screen } from "@testing-library/react";

import { UsuariosLista } from "./usuarios-lista.component";

const usuarios = [
  { id: "a1", nome: "Cledson", email: "c@x.local", papel: "admin", setor: "administrativo" },
  { id: "f1", nome: "Jéssica", email: "j@x.local", papel: "funcionario", setor: "financeiro" },
];

describe("UsuariosLista", () => {
  it("mostra nome, e-mail, papel e setor de cada usuário", () => {
    render(<UsuariosLista usuarios={usuarios} acoes={() => null} />);

    expect(screen.getByText("Jéssica")).toBeInTheDocument();
    expect(screen.getByText(/j@x\.local · Funcionário · financeiro/)).toBeInTheDocument();
  });

  it("renderiza a ação de cada linha vinda do slot", () => {
    render(
      <UsuariosLista
        usuarios={usuarios}
        acoes={(u) => (u.papel === "admin" ? null : <button>Ação {u.nome}</button>)}
      />,
    );

    expect(screen.getByRole("button", { name: "Ação Jéssica" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ação Cledson/ })).not.toBeInTheDocument();
  });
});
