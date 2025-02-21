import("node-fetch").then(fetchModule => {
  const { Response } = fetchModule;
});
import fs from "fs";
import dotenv from "dotenv";

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

// Interfaces existentes
interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  // ...outras propriedades...
}

interface CommitAuthor {
  name: string;
  email: string;
  date: string;
}

interface CommitData {
  author: CommitAuthor;
  message: string;
  // ...outras propriedades...
}

interface Commit {
  sha: string;
  commit: CommitData;
  author: { login: string } | null;
  // ...outras propriedades...
}

interface Options {
  month?: number;
  year?: number;
}

class GitHubCommitFetcher {
  private token: string;
  private orgName: string;
  private targetUser: string;
  private HEADERS: Record<string, string>;
  private commitsByDay: Record<string, Array<{ repo: string; message: string; author: string; date: string }>> = {};

  constructor(token: string, orgName: string, targetUser: string) {
    this.token = token;
    this.orgName = orgName;
    this.targetUser = targetUser;
    this.HEADERS = {
      Authorization: `token ${this.token}`,
      "User-Agent": "GitHub-Commit-Fetcher",
    };
  }

  private async fetchJson(url: string): Promise<any> {
    const response: Response = await fetch(url, { headers: this.HEADERS });
    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  private async getRepos(): Promise<Repository[]> {
    let repos: Repository[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const url = `https://api.github.com/orgs/${this.orgName}/repos?page=${page}&per_page=${perPage}`;
      try {
        const data: Repository[] = await this.fetchJson(url);
        if (data.length > 0) {
          repos = repos.concat(data);
          page++;
        } else {
          hasMore = false;
        }
      } catch (error) {
        throw new Error(`Erro ao obter repositórios: ${error instanceof Error ? error.message : error}`);
      }
    }

    return repos;
  }

  private async getCommits(repoFullName: string, since: Date, until: Date): Promise<Commit[]> {
    let commits: Commit[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const url = `https://api.github.com/repos/${repoFullName}/commits?page=${page}&per_page=${perPage}&author=${this.targetUser}&since=${since.toISOString()}&until=${until.toISOString()}`;
      try {
        const response: Response = await fetch(url, { headers: this.HEADERS });
        if (response.status === 404) {
          console.warn(`Repositório não encontrado: ${repoFullName}`);
          break;
        }
        if (response.status === 409) {
          console.warn(`Repositório vazio ou conflito ao acessar: ${repoFullName}`);
          break;
        }
        if (!response.ok) {
          throw new Error(`Falha ao obter commits para ${repoFullName}: ${response.status} ${response.statusText}`);
        }
        const data: Commit[] = await response.json() as Commit[];
        if (data.length > 0) {
          commits = commits.concat(data);
          page++;
        } else {
          hasMore = false;
        }
      } catch (error) {
        throw new Error(`Erro ao obter commits para ${repoFullName}: ${error instanceof Error ? error.message : error}`);
      }
    }

    return commits;
  }

  private async processRepoCommits(repo: Repository, since: Date, until: Date): Promise<void> {
    const repoFullName = repo.full_name;
    console.log(`Coletando commits do repositório: ${repoFullName}`);
    try {
      const commits: Commit[] = await this.getCommits(repoFullName, since, until);
      commits.forEach(commit => {
        const commitDateStr: string = commit.commit.author.date;
        const commitDate = new Date(commitDateStr);
        if (commitDate >= since && commitDate <= until) {
          const dayKey = this.formatDatePtBR(commitDateStr);
          if (!this.commitsByDay[dayKey]) {
            this.commitsByDay[dayKey] = [];
          }
          this.commitsByDay[dayKey].push({
            repo: repoFullName,
            message: commit.commit.message,
            author: commit.commit.author.name,
            date: commitDateStr,
          });
        }
      });
    } catch (error) {
      console.error(`Erro ao processar ${repoFullName}: ${error instanceof Error ? error.message : error}`);
    }
  }

  private formatDatePtBR(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  }

  private static parseArguments(): Options {
    const args = process.argv.slice(2);
    const options: Options = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      switch (arg) {
        case "--month":
        case "-m": {
          const month = parseInt(args[i + 1], 10);
          if (isNaN(month) || month < 1 || month > 12) {
            console.error("Erro: O mês deve ser um número entre 1 e 12.");
            this.showUsage();
            process.exit(1);
          }
          options.month = month;
          i++;
          break;
        }
        case "--year":
        case "-y": {
          const year = parseInt(args[i + 1], 10);
          if (isNaN(year) || year < 1) {
            console.error("Erro: O ano deve ser um número inteiro positivo.");
            this.showUsage();
            process.exit(1);
          }
          options.year = year;
          i++;
          break;
        }
        case "--help":
        case "-h":
          this.showUsage();
          process.exit(0);
        default:
          console.error(`Argumento desconhecido: ${arg}`);
          this.showUsage();
          process.exit(1);
      }
    }
    return options;
  }

  private static showUsage(): void {
    console.log(`Uso: node script.js [opções]

Opções:
  --month, -m <número>   Mês para análise (1-12)
  --year, -y <número>    Ano para análise (por exemplo, 2023)
  --help, -h             Exibe esta ajuda
`);
  }

  public async run(): Promise<void> {
    try {
      const options = GitHubCommitFetcher.parseArguments();
      const today = new Date();
      const month = options.month || today.getMonth() + 1;
      const year = options.year || today.getFullYear();

      if (month < 1 || month > 12) {
        console.error("Erro: O mês deve ser um número entre 1 e 12.");
        GitHubCommitFetcher.showUsage();
        process.exit(1);
      }
      if (year < 1) {
        console.error("Erro: O ano deve ser um número inteiro positivo.");
        GitHubCommitFetcher.showUsage();
        process.exit(1);
      }

      const firstDayOfMonth = new Date(year, month - 1, 1);
      const lastDayOfMonth = new Date(year, month, 0);

      console.log(`Coletando commits de ${this.targetUser} da organização ${this.orgName} para o período de ${this.formatDatePtBR(firstDayOfMonth.toISOString())} a ${this.formatDatePtBR(lastDayOfMonth.toISOString())}.`);

      const repos = await this.getRepos();
      const promises = repos.map(repo => this.processRepoCommits(repo, firstDayOfMonth, lastDayOfMonth));
      await Promise.allSettled(promises);

      const sortedCommitsByDay: Record<string, Array<{ repo: string; message: string; author: string; date: string }>> = {};
      Object.keys(this.commitsByDay)
        .sort((a, b) => {
          const [dayA, monthA, yearA] = a.split("/").map(Number);
          const [dayB, monthB, yearB] = b.split("/").map(Number);
          return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
        })
        .forEach(key => { sortedCommitsByDay[key] = this.commitsByDay[key]; });

      const outputFile = `commits_${year}_${month.toString().padStart(2, "0")}.json`;
      await fs.promises.writeFile(outputFile, JSON.stringify(sortedCommitsByDay, null, 2));
      console.log(`Commits salvos em ${outputFile}`);
    } catch (error) {
      console.error("Erro:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}

const GITHUB_TOKEN: string | undefined = process.env.GITHUB_TOKEN;
const ORG_NAME: string | undefined = process.env.ORG_NAME;
const TARGET_USER: string | undefined = process.env.TARGET_USER;

if (!GITHUB_TOKEN) {
  console.error("Erro: O token do GitHub não está definido. Por favor, defina a variável de ambiente GITHUB_TOKEN.");
  process.exit(1);
}

if (!ORG_NAME) {
  console.error("Erro: O nome da organização não está definido. Por favor, defina a variável de ambiente ORG_NAME.");
  process.exit(1);
}

if (!TARGET_USER) {
  console.error("Erro: O usuário alvo não está definido. Por favor, defina a variável de ambiente TARGET_USER.");
  process.exit(1);
}

const fetcher = new GitHubCommitFetcher(GITHUB_TOKEN, ORG_NAME, TARGET_USER);
fetcher.run();
