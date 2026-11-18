import { fireEvent, render, screen } from "@testing-library/react";

import { BotaoDeArquivo } from "./botao-de-arquivo.component";

const montar = (props: Partial<Parameters<typeof BotaoDeArquivo>[0]> = {}) => {
  const onEscolher = jest.fn();
  render(
    <BotaoDeArquivo
      rotulo="Escolher foto"
      rotuloAcessivel="Escolher foto do perfil"
      aceitar="image/png"
      onEscolher={onEscolher}
      {...props}
    />,
  );
  return {
    onEscolher,
    campo: screen.getByLabelText("Escolher foto do perfil") as HTMLInputElement,
  };
};

describe("BotaoDeArquivo", () => {
  it("entrega o arquivo escolhido e esvazia o campo para aceitar o mesmo arquivo de novo", () => {
    const { onEscolher, campo } = montar();
    const arquivo = new File(["x"], "foto.png", { type: "image/png" });

    fireEvent.change(campo, { target: { files: [arquivo] } });

    expect(onEscolher).toHaveBeenCalledWith(arquivo);
    expect(campo.value).toBe("");
  });

  it("sem arquivo escolhido não chama onEscolher", () => {
    const { onEscolher, campo } = montar();

    fireEvent.change(campo, { target: { files: [] } });

    expect(onEscolher).not.toHaveBeenCalled();
  });

  it("ocupado segue focável: aria-disabled, sem disabled", () => {
    const { campo } = montar({ ocupado: true });

    expect(campo).toHaveAttribute("aria-disabled", "true");
    expect(campo).not.toBeDisabled();
  });

  it("recusado marca aria-invalid e aponta para a dica", () => {
    const { campo } = montar({ invalido: true, descritoPor: "dica erro" });

    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAttribute("aria-describedby", "dica erro");
  });
});
