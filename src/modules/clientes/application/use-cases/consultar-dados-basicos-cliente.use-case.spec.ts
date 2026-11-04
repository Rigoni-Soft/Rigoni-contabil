import type {
  ClienteQueryPort,
  DadosBasicosClienteDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { ok } from "@/shared/kernel/result";

import { ConsultarDadosBasicosCliente } from "./consultar-dados-basicos-cliente.use-case";

const DTO: DadosBasicosClienteDto = {
  id: "11111111-1111-1111-1111-111111111111",
  empresa: "Padaria Pão Quente Ltda",
  cnpj: "11444777000161",
  regime: "lucro_presumido",
};

const sessaoCom = (autenticado: boolean): SessaoPort => ({
  usuarioAtual: async () => (autenticado ? { id: "u1", papel: "lider", setor: "rh" } : null),
});

const queryCom = (dto: DadosBasicosClienteDto | null) =>
  ({ buscarDadosBasicos: async () => ok(dto) }) as unknown as ClienteQueryPort;

describe("ConsultarDadosBasicosCliente", () => {
  it("devolve só empresa, CNPJ e Regime", async () => {
    const r = await new ConsultarDadosBasicosCliente(sessaoCom(true), queryCom(DTO)).execute(
      DTO.id,
    );

    expect(r.ok && r.value).toEqual(DTO);
  });

  it("recusa quem não está autenticado", async () => {
    const r = await new ConsultarDadosBasicosCliente(sessaoCom(false), queryCom(DTO)).execute(
      DTO.id,
    );

    expect(r.ok).toBe(false);
  });
});
