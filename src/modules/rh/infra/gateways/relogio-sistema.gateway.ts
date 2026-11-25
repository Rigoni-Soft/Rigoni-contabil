import type { RelogioPort } from "@/modules/rh/application/ports/out/relogio.provider";

export class RelogioSistemaGateway implements RelogioPort {
  agora(): Date {
    return new Date();
  }
}
