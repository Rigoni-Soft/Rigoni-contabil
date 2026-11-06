import type { RegistroAcaoDto } from "@/modules/auditoria/application/dtos/registro-acao.dto";
import { registroAcaoParaDto } from "@/modules/auditoria/application/mappers/registro-acao-para-dto.mapper";
import type {
  RegistrarAcaoInput,
  RegistrarAcaoPort,
} from "@/modules/auditoria/application/ports/in/registrar-acao.provider";
import type { RegistroAcaoRepository } from "@/modules/auditoria/application/ports/out/registro-acao.repository";
import { RegistroAcao } from "@/modules/auditoria/domain/entities/registro-acao.entity";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export class RegistrarAcao implements RegistrarAcaoPort {
  constructor(private readonly registros: RegistroAcaoRepository) {}

  async execute(input: RegistrarAcaoInput): Promise<Result<RegistroAcaoDto, AppError>> {
    const construido = RegistroAcao.builder()
      .comId(crypto.randomUUID())
      .comAtor(input.ator)
      .comSetor(input.setor)
      .comAcao(input.acao)
      .comAlvo(input.alvo)
      .comResultado(input.resultado)
      .comDataHora(new Date())
      .build();
    if (!construido.ok) return construido;

    const salvo = await this.registros.salvar(construido.value);
    if (!salvo.ok) return salvo;

    return { ok: true, value: registroAcaoParaDto(construido.value) };
  }
}
