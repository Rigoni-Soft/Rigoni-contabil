import { render, screen } from "@testing-library/react";

import { AuditoriaFeed } from "./auditoria-feed.component";

const REGISTRO = {
  id: "1",
  ator: "11111111-1111-1111-1111-111111111111",
  setor: "administrativo",
  acao: "usuario.criar",
  alvo: "funcionario@rigonicontabil.local",
  resultado: "sucesso",
  dataHora: "2026-09-25T12:00:00.000Z",
};

describe("AuditoriaFeed", () => {
  it("lista os registros recebidos", () => {
    render(<AuditoriaFeed registros={[REGISTRO]} />);

    expect(screen.getByText("usuario.criar")).toBeInTheDocument();
    expect(screen.getByText("funcionario@rigonicontabil.local")).toBeInTheDocument();
    expect(screen.getByText(/sucesso/i)).toBeInTheDocument();
  });

  it("mostra mensagem de vazio quando não há registros", () => {
    render(<AuditoriaFeed registros={[]} />);

    expect(screen.getByText(/nenhuma ação registrada/i)).toBeInTheDocument();
  });
});
