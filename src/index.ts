import("node-fetch").then((fetchModule) => {
  const { Response } = fetchModule;
});
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

// Interfaces existentes
interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
}

interface CommitAuthor {
  name: string;
  email: string;
  date: string;
}

interface CommitData {
  author: CommitAuthor;
  message: string;
}

interface Commit {
  sha: string;
  commit: CommitData;
  author: { login: string } | null;
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
  private commitsByDay: Record<
    string,
    Array<{ repo: string; message: string; author: string; date: string }>
  > = {};

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
      throw new Error(
        `Erro na requisição: ${response.status} ${response.statusText}`
      );
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
        throw new Error(
          `Erro ao obter repositórios: ${
            error instanceof Error ? error.message : error
          }`
        );
      }
    }

    return repos;
  }

  private async getCommits(
    repoFullName: string,
    since: Date,
    until: Date
  ): Promise<Commit[]> {
    let commits: Commit[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const url = `https://api.github.com/repos/${repoFullName}/commits?page=${page}&per_page=${perPage}&author=${
        this.targetUser
      }&since=${since.toISOString()}&until=${until.toISOString()}`;
      try {
        const response: Response = await fetch(url, { headers: this.HEADERS });
        if (response.status === 404) {
          console.warn(`Repositório não encontrado: ${repoFullName}`);
          break;
        }
        if (response.status === 409) {
          console.warn(
            `Repositório vazio ou conflito ao acessar: ${repoFullName}`
          );
          break;
        }
        if (!response.ok) {
          throw new Error(
            `Falha ao obter commits para ${repoFullName}: ${response.status} ${response.statusText}`
          );
        }
        const data: Commit[] = await response.json();
        if (data.length > 0) {
          commits = commits.concat(data);
          page++;
        } else {
          hasMore = false;
        }
      } catch (error) {
        throw new Error(
          `Erro ao obter commits para ${repoFullName}: ${
            error instanceof Error ? error.message : error
          }`
        );
      }
    }

    return commits;
  }

  private async processRepoCommits(
    repo: Repository,
    since: Date,
    until: Date
  ): Promise<void> {
    const repoFullName = repo.full_name;
    console.log(`Coletando commits do repositório: ${repoFullName}`);
    try {
      const commits: Commit[] = await this.getCommits(
        repoFullName,
        since,
        until
      );
      commits.forEach((commit) => {
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
      console.error(
        `Erro ao processar ${repoFullName}: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  private formatDatePtBR(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  }

  public async run(): Promise<void> {
    try {
      const today = new Date();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();

      const firstDayOfMonth = new Date(year, month - 1, 1);
      const lastDayOfMonth = new Date(year, month, 0);

      console.log(
        `Coletando commits de ${this.targetUser} da organização ${
          this.orgName
        } para o período de ${this.formatDatePtBR(
          firstDayOfMonth.toISOString()
        )} a ${this.formatDatePtBR(lastDayOfMonth.toISOString())}.`
      );

      const repos = await this.getRepos();
      const promises = repos.map((repo) =>
        this.processRepoCommits(repo, firstDayOfMonth, lastDayOfMonth)
      );
      await Promise.allSettled(promises);

      const orderedCommitsByDay: typeof this.commitsByDay = {};

      const dateKeys = Object.keys(this.commitsByDay);
      const sortedDateKeys = dateKeys.sort((a, b) => {
        const [dayA, monthA, yearA] = a.split("/").map(Number);
        const [dayB, monthB, yearB] = b.split("/").map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA.getTime() - dateB.getTime();
      });

      sortedDateKeys.forEach((dateKey) => {
        orderedCommitsByDay[dateKey] = this.commitsByDay[dateKey];
      });

      const outputDir = path.join(__dirname, "../output");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputFile = path.join(
        outputDir,
        `commits_${year}_${month.toString().padStart(2, "0")}.json`
      );
      await fs.promises.writeFile(
        outputFile,
        JSON.stringify(orderedCommitsByDay, null, 2)
      );
      console.log(`Commits salvos em ${outputFile}`);
    } catch (error) {
      console.error("Erro:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ORG_NAME = process.env.ORG_NAME;
const TARGET_USER = process.env.TARGET_USER;

if (!GITHUB_TOKEN || !ORG_NAME || !TARGET_USER) {
  console.error(
    "Erro: Certifique-se de definir as variáveis de ambiente GITHUB_TOKEN, ORG_NAME e TARGET_USER."
  );
  process.exit(1);
}

const fetcher = new GitHubCommitFetcher(GITHUB_TOKEN, ORG_NAME, TARGET_USER);
fetcher.run();
