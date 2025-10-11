import path from "path";
import { CliConfig } from "../types";
import {
  parseCliArg,
  hasCliFlag,
  toIntOrUndefined,
} from "../utils/generalUtils";

/**
 * Mostra a ajuda do comando
 */
export function showHelp(): void {
  console.log(`
Uso: ts-node src/index.ts [flags]

Período (precedência: today > last-days > month/year):
  --today                  Usa apenas o dia de hoje
  --last-days=N            Usa os últimos N dias (ex.: --last-days=10)
  --month=MM               Mês (1..12) para report mensal
  --year=YYYY              Ano (ex.: 2025) para report mensal

Branches:
  --all-branches           Processa todas as branches
  --main-only              Processa apenas a branch padrão (default)
                           (padrão: main-only, a menos que --all-branches seja informado)

Usuários:
  --all-users              Lista commits de todos os usuários
                           (padrão: apenas TARGET_USER definido no .env)

Outros:
  --quiet                  Menos logs
  --no-raw                 Não salva o arquivo raw_commits_*.json
  --out-dir=PATH           Diretório base de saída (default: ./output)
  --help | -h              Mostra esta ajuda

Exemplos:
  ts-node src/index.ts --today --all-branches
  ts-node src/index.ts --last-days=15 --main-only
  ts-node src/index.ts --month=9 --year=2025
  ts-node src/index.ts --today --all-users --all-branches
  ts-node src/index.ts --today --out-dir=./data --no-raw
`);
}

/**
 * Verifica se deve mostrar ajuda e sai se necessário
 */
export function maybeShowHelp(): void {
  if (hasCliFlag("help") || hasCliFlag("h")) {
    showHelp();
    process.exit(0);
  }
}

/**
 * Valida as variáveis de ambiente obrigatórias
 */
export function validateEnvironment(
  githubToken: string,
  account: string,
  targetUser: string,
  allUsers: boolean
): void {
  if (!githubToken || !account) {
    console.error(
      "❌ Erro: defina GITHUB_TOKEN e ORG_NAME (ou ACCOUNT) no .env ou variáveis de ambiente."
    );
    process.exit(1);
  }

  // Validação: se não for all-users, precisa de TARGET_USER
  if (!allUsers && !targetUser) {
    console.error(
      "❌ Erro de configuração: por padrão só listamos um usuário, mas TARGET_USER não foi definido.\n" +
        "   Defina TARGET_USER no .env ou use a flag --all-users para listar todos os usuários."
    );
    process.exit(1);
  }
}

/**
 * Lê e processa todas as configurações da linha de comando e variáveis de ambiente
 */
export function parseCliConfig(): CliConfig {
  // Variáveis de ambiente
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
  const ACCOUNT = process.env.ORG_NAME || process.env.ACCOUNT || "";
  const TARGET_USER = process.env.TARGET_USER || "";

  // Flags de configuração
  const QUIET = hasCliFlag("quiet") || process.env.QUIET === "true";
  const NO_RAW = hasCliFlag("no-raw") || process.env.NO_RAW === "true";
  const ALL_USERS = hasCliFlag("all-users") || process.env.ALL_USERS === "true";

  // Argumentos de período
  const monthArg = parseCliArg("month") || process.env.MONTH;
  const yearArg = parseCliArg("year") || process.env.YEAR;
  const lastDaysArg = parseCliArg("last-days") || process.env.LAST_DAYS;
  const todayOnly = hasCliFlag("today") || process.env.TODAY_ONLY === "true";

  // Configuração de branches
  const allBranches =
    hasCliFlag("all-branches") ||
    (!(hasCliFlag("main-only") || process.env.MAIN_ONLY === "true") &&
      process.env.ALL_BRANCHES === "true"); // compatibilidade com envs

  // Diretório de saída
  const outDirBase =
    parseCliArg("out-dir") ||
    process.env.OUT_DIR ||
    path.join(__dirname, "../../output");

  // Converte strings para números
  const monthNum = toIntOrUndefined(monthArg);
  const yearNum = toIntOrUndefined(yearArg);
  const lastDaysNum = toIntOrUndefined(lastDaysArg);

  return {
    githubToken: GITHUB_TOKEN,
    account: ACCOUNT,
    targetUser: TARGET_USER || undefined,
    month: monthNum,
    year: yearNum,
    todayOnly,
    allBranches,
    lastDays: lastDaysNum,
    outDirBase,
    allUsers: ALL_USERS,
    quiet: QUIET,
    saveRaw: !NO_RAW,
  };
}
