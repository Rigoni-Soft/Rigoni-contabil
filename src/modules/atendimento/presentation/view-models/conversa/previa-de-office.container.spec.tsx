import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PreviaDeOfficeContainer } from "./previa-de-office.container";

const abrir = jest.fn();
jest.mock("./use-previa-de-office.hook", () => ({
  usePreviaDeOffice: () => ({ estado: "fechado", previa: undefined, abrir }),
}));

describe("PreviaDeOfficeContainer", () => {
  it("mostra o arquivo e clicar em Visualizar chama o abrir do hook", async () => {
    render(<PreviaDeOfficeContainer nome="balanco.docx" url="/a" formato="docx" painelId="p1" />);

    await userEvent.click(screen.getByRole("button", { name: "Visualizar balanco.docx" }));

    expect(abrir).toHaveBeenCalled();
  });
});
