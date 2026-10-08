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
    expect(screen.getByText(/j@x\.local · Funcionário · Financeiro/)).toBeInTheDocument();
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

  it("avisa quando a conta está desativada com o bloqueio ainda pendente", () => {
    render(
      <UsuariosLista usuarios={[{ ...usuarios[0], bloqueioPendente: true }]} acoes={() => null} />,
    );

    expect(screen.getByText(/bloqueio da conta ainda não foi concluído/)).toBeInTheDocument();
  });
});
