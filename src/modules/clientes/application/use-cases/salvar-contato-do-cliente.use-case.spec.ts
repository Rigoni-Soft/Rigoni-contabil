import type { ContatoDoClienteRepository } from "@/modules/clientes/application/ports/out/contato-do-cliente.repository";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { SalvarContatoDoCliente } from "./salvar-contato-do-cliente.use-case";

const CLIENTE = "11111111-1111-1111-1111-111111111111";
const CONTATO = { nome: " Maria ", telefone: "11999990000", email: "MARIA@exemplo.com" };

function montar(logado = true, resultado: Result<string, AppError> = ok("c-1")) {
  const chamadas: unknown[][] = [];
  const sessao: SessaoPort = {
    usuarioAtual: async () => (logado ? { id: "u1", papel: "funcionario", setor: "rh" } : null),
  };
  const repositorio: ContatoDoClienteRepository = {
    salvar: async (...args) => {
      chamadas.push(args);
      return resultado;
    },
  };
  return { caso: new SalvarContatoDoCliente(sessao, repositorio), chamadas };
}

describe("SalvarContatoDoCliente", () => {
  it("grava o contato normalizado e devolve o id", async () => {
    const { caso, chamadas } = montar();

    const r = await caso.execute({ clienteId: CLIENTE, contato: CONTATO });

    expect(r.ok && r.value).toEqual({ id: "c-1" });
    expect(chamadas).toEqual([
      [
        CLIENTE,
        { id: undefined, nome: "Maria", telefone: "11999990000", email: "maria@exemplo.com" },
      ],
    ]);
  });

  it("recusa quem não está logado, sem gravar", async () => {
    const { caso, chamadas } = montar(false);

    const r = await caso.execute({ clienteId: CLIENTE, contato: CONTATO });

    expect(r.ok).toBe(false);
    expect(chamadas).toEqual([]);
  });

  it("recusa contato sem nenhum canal, sem gravar", async () => {
    const { caso, chamadas } = montar();

    const r = await caso.execute({
      clienteId: CLIENTE,
      contato: { nome: "Maria", telefone: "", email: "" },
    });

    expect(r.ok).toBe(false);
    expect(chamadas).toEqual([]);
  });

  it("repassa a falha do repositório", async () => {
    const { caso } = montar(true, err(new ValidationError("Este Cliente já tem o contato.")));

    const r = await caso.execute({ clienteId: CLIENTE, contato: CONTATO });

    expect(!r.ok && r.error.message).toBe("Este Cliente já tem o contato.");
  });
});
