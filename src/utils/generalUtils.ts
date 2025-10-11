import fs from "fs";

/**
 * Utilitários gerais para o projeto
 */

/**
 * Obtém implementação do fetch (nativo ou node-fetch)
 */
export async function getFetch(): Promise<any> {
  if (typeof (globalThis as any).fetch === "function") {
    return (globalThis as any).fetch;
  }
  try {
    const mod = await import("node-fetch");
    return mod.default ?? mod;
  } catch {
    throw new Error(
      "fetch não disponível. Use Node >=18 ou instale node-fetch (npm i node-fetch)."
    );
  }
}

/**
 * Extrai valor de um argumento da linha de comando
 */
export function parseCliArg(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=")[1] : undefined;
}

/**
 * Verifica se uma flag existe na linha de comando
 */
export function hasCliFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/**
 * Converte string para número ou retorna undefined
 */
export function toIntOrUndefined(val?: string): number | undefined {
  if (!val) return undefined;
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Cria diretório se não existir (recursivamente)
 */
export function ensureDir(p: string): void {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}
