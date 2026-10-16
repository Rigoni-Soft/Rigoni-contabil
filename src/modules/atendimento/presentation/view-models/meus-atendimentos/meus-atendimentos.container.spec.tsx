import { render, screen } from "@testing-library/react";

import { MeusAtendimentosContainer } from "./meus-atendimentos.container";

jest.mock(
  "@/modules/atendimento/presentation/view-models/meus-atendimentos/use-meus-atendimentos.hook",
  () => ({
    useMeusAtendimentos: () => ({
      atendimentos: [
        { id: "at-1", href: "/atendimento/at-1", titulo: "Maria", detalhe: "Padaria Ltda" },
      ],
    }),
  }),
);

jest.mock("@/modules/atendimento/presentation/view-models/fila/use-aviso-fila.hook", () => ({
  useAvisoFila: () => ({
    aviso: {
      id: "fila",
      href: "/fila",
      titulo: "Fila de atendimento",
      detalhe: "1 cliente aguardando",
    },
  }),
}));

describe("MeusAtendimentosContainer", () => {
  it("passa os Atendimentos do hook pra View", () => {
    render(<MeusAtendimentosContainer />);

    expect(screen.getByRole("link", { name: /Maria/ })).toHaveAttribute(
      "href",
      "/atendimento/at-1",
    );
  });

  it("mostra o aviso da Fila junto dos Atendimentos", () => {
    render(<MeusAtendimentosContainer />);

    expect(screen.getByRole("link", { name: /Fila de atendimento/ })).toHaveAttribute(
      "href",
      "/fila",
    );
  });
});
