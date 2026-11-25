export interface AutenticacaoJobPort {
  autorizado(authorization: string | null): boolean;
}
