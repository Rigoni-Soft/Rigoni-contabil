import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EnviosDoContato, type EnviosDaLinha } from "./envios-do-contato.component";

const ENVIOS: EnviosDaLinha = {
  opcoes: [
    { valor: "todos", rotulo: "Todos os envios" },
    { valor: "das", rotulo: "DAS" },
    { valor: "avisos", rotulo: "Avisos" },
  ],
  marcados: ["das"],
  onAlternar: jest.fn(),
};

const CANAL = {
  opcoes: [
    { valor: "whatsapp", rotulo: "WhatsApp" },
    { valor: "email", rotulo: "E-mail" },
  ],
  valor: "",
  onMudar: jest.fn(),
};

function montar(envios: EnviosDaLinha, editando: boolean) {
  return render(<EnviosDoContato indice={0} numero={1} envios={envios} editando={editando} />);
}

describe("EnviosDoContato", () => {
  it("o grupo se chama 'Envios do contato N' e o rótulo visível 'Recebe' fica fora do nome", () => {
    montar(ENVIOS, true);

    const grupo = screen.getByRole("group", { name: "Envios do contato 1" });
    expect(grupo).toHaveTextContent("Recebe");
  });

  it("editando: um checkbox por tipo, com o marcado, e clicar chama o callback com o valor", async () => {
    const aoAlternar = jest.fn();
    const usuario = userEvent.setup();
    montar({ ...ENVIOS, onAlternar: aoAlternar }, true);

    expect(screen.getByLabelText("DAS")).toBeChecked();
    expect(screen.getByLabelText("Avisos")).not.toBeChecked();
    await usuario.click(screen.getByLabelText("Avisos"));
    expect(aoAlternar).toHaveBeenCalledWith("avisos");
  });

  it("fora da edição: os tipos marcados em texto, sem checkbox", () => {
    montar({ ...ENVIOS, marcados: ["das", "avisos"] }, false);

    expect(screen.getByText("DAS, Avisos")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("fora da edição: 'Todos os envios' vale por todos e não repete os tipos", () => {
    montar({ ...ENVIOS, marcados: ["todos", "das", "avisos"] }, false);

    expect(screen.getByText("Todos os envios")).toBeInTheDocument();
    expect(screen.queryByText(/DAS/)).toBeNull();
  });

  it("fora da edição, sem nada marcado: diz que não há envio", () => {
    montar({ ...ENVIOS, marcados: [] }, false);

    expect(screen.getByText("nenhum envio")).toBeInTheDocument();
  });

  it("com os dois canais: editando é um select obrigatório; fora da edição, o texto 'Enviar por'", () => {
    const { rerender } = montar({ ...ENVIOS, canal: { ...CANAL, valor: "email" } }, true);
    expect(screen.getByLabelText(/^Enviar por/)).toHaveValue("email");

    rerender(
      <EnviosDoContato
        indice={0}
        numero={1}
        envios={{ ...ENVIOS, canal: { ...CANAL, valor: "email" } }}
        editando={false}
      />,
    );
    expect(screen.getByText("Enviar por: E-mail")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Enviar por/)).toBeNull();
  });

  it("canal ainda não escolhido aparece como 'não escolhido' fora da edição", () => {
    montar({ ...ENVIOS, canal: CANAL }, false);

    expect(screen.getByText("Enviar por: não escolhido")).toBeInTheDocument();
  });

  it("o aviso do canal perdido aparece nos dois modos", () => {
    const { rerender } = montar({ ...ENVIOS, aviso: "O contato deixou de ter o e-mail." }, true);
    expect(screen.getByText("O contato deixou de ter o e-mail.")).toBeInTheDocument();

    rerender(
      <EnviosDoContato
        indice={0}
        numero={1}
        envios={{ ...ENVIOS, aviso: "O contato deixou de ter o e-mail." }}
        editando={false}
      />,
    );
    expect(screen.getByText("O contato deixou de ter o e-mail.")).toBeInTheDocument();
  });
});
