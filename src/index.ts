// src/index.ts
import dotenv from "dotenv";
import { GitHubCommitFetcher } from "./services/GitHubService";
import { maybeShowHelp, parseCliConfig, validateEnvironment } from "./cli";

dotenv.config();

// Verifica se deve mostrar ajuda
maybeShowHelp();

// Lê configurações da CLI e variáveis de ambiente
const config = parseCliConfig();

// Valida configurações obrigatórias
validateEnvironment(
  config.githubToken,
  config.account,
  config.targetUser || "",
  config.allUsers
);

// Cria instância do fetcher
const fetcher = new GitHubCommitFetcher({
  token: config.githubToken,
  account: config.account,
  targetUser: config.targetUser,
  quiet: config.quiet,
  saveRaw: config.saveRaw,
  openaiApiKey: config.openaiApiKey,
  openaiModel: config.openaiModel,
  openaiInstruction: config.openaiInstruction,
  openaiOutputFile: config.openaiOutputFile,
});

// Executa a coleta
fetcher
  .run(
    config.month,
    config.year,
    config.todayOnly,
    config.allBranches,
    config.lastDays,
    config.outDirBase,
    config.allUsers
  )
  .catch((err) => {
    console.error("\n❌ Erro fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
