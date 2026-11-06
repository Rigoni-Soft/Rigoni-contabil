import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FeedContainer } from "./feed.container";

const aoSubmeter = jest.fn((e?: React.BaseSyntheticEvent) => e?.preventDefault());
const aoLimpar = jest.fn();

jest.mock("@/modules/auditoria/presentation/view-models/feed/use-feed.hook", () => ({
  useFeed: () => ({
    register: () => ({}),
    errors: {},
    aoSubmeter,
    aoLimpar,
    registros: [
      {
        id: "1",
        ator: "admin-1",
        setor: "administrativo",
        acao: "usuario.criar",
        alvo: "funcionario@rigonicontabil.local",
        resultado: "sucesso",
        dataHora: "2026-09-25T12:00:00.000Z",
      },
    ],
    carregando: false,
    erro: undefined,
  }),
}));

describe("FeedContainer", () => {
  it("passa os registros do hook pra View", () => {
    render(<FeedContainer initialData={[]} />);

    expect(screen.getByText("funcionario@rigonicontabil.local")).toBeInTheDocument();
  });

  it("clicar em Limpar chama a função do hook", async () => {
    const usuario = userEvent.setup();
    render(<FeedContainer initialData={[]} />);

    await usuario.click(screen.getByRole("button", { name: "Limpar" }));

    expect(aoLimpar).toHaveBeenCalledTimes(1);
  });
});
