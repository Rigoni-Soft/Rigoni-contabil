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

describe("MeusAtendimentosContainer", () => {
  it("passa os Atendimentos do hook pra View", () => {
    render(<MeusAtendimentosContainer />);

    expect(screen.getByRole("link", { name: /Maria/ })).toHaveAttribute(
      "href",
      "/atendimento/at-1",
    );
  });
});
