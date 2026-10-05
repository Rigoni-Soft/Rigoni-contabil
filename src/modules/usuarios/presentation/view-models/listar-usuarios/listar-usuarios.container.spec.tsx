import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

import { ListarUsuariosContainer } from "./listar-usuarios.container";

const executeMock = jest.fn();
const refreshMock = jest.fn();

jest.mock("@/main/usuarios.factory", () => ({
  makeDesativarUsuario: () => ({ execute: executeMock }),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const usuarios = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    nome: "Jéssica",
    email: "j@x.local",
    papel: "funcionario",
    setor: "financeiro",
  },
];

async function desativar() {
  const usuario = userEvent.setup();
  render(<ListarUsuariosContainer usuarios={usuarios} />);
  await usuario.click(screen.getByRole("button", { name: "Desativar Jéssica" }));
  await usuario.click(screen.getByRole("button", { name: "Confirmar desativação de Jéssica" }));
}

describe("ListarUsuariosContainer", () => {
  beforeEach(() => {
    executeMock.mockReset();
    refreshMock.mockReset();
  });

  it("desativa e recarrega a lista", async () => {
    executeMock.mockResolvedValue(ok(undefined));

    await desativar();

    expect(executeMock).toHaveBeenCalledWith({ usuarioId: usuarios[0].id });
    expect(refreshMock).toHaveBeenCalled();
  });

  it("mostra o erro do caso de uso e não recarrega", async () => {
    executeMock.mockResolvedValue(err(new ForbiddenError("Só Admin desativa usuários.")));

    await desativar();

    expect(await screen.findByRole("alert")).toHaveTextContent("Só Admin desativa usuários.");
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
