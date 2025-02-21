import fetch from 'node-fetch';
import fs from 'fs';
import dotenv from 'dotenv';

// Configurações
dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ORG_NAME = process.env.ORG_NAME;
const TARGET_USER = process.env.TARGET_USER;

const HEADERS = {
    Authorization: `token ${GITHUB_TOKEN}`,
};

// Função para obter todos os repositórios da organização
async function getRepos(orgName) {
    let repos = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const url = `https://api.github.com/orgs/${orgName}/repos?page=${page}&per_page=100`;
        const response = await fetch(url, { headers: HEADERS });
        const data = await response.json();

        if (data.length > 0) {
            repos = repos.concat(data);
            page++;
        } else {
            hasMore = false;
        }
    }

    return repos;
}

// Função para obter todos os commits de um repositório feitos pelo usuário específico
async function getCommits(repoFullName, targetUser) {
    let commits = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const url = `https://api.github.com/repos/${repoFullName}/commits?page=${page}&per_page=100&author=${targetUser}`;
        const response = await fetch(url, { headers: HEADERS });
        const data = await response.json();

        if (data.length > 0) {
            commits = commits.concat(data);
            page++;
        } else {
            hasMore = false;
        }
    }

    return commits;
}

// Função para formatar a data no padrão pt_BR (DD/MM/AAAA)
function formatDatePtBR(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// Função principal
async function main() {
    const repos = await getRepos(ORG_NAME);
    const commitsByDay = {};

    // Calcula o primeiro e o último dia do mês atual
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    for (const repo of repos) {
        const repoFullName = repo.full_name;
        console.log(`Coletando commits do repositório: ${repoFullName}`);
        const commits = await getCommits(repoFullName, TARGET_USER);

        for (const commit of commits) {
            const commitDateStr = commit.commit.author.date;
            const commitDate = new Date(commitDateStr);

            // Filtra commits do mês atual
            if (commitDate >= firstDayOfMonth && commitDate <= lastDayOfMonth) {
                const dayKey = formatDatePtBR(commitDateStr); // Formato DD/MM/AAAA

                if (!commitsByDay[dayKey]) {
                    commitsByDay[dayKey] = [];
                }

                commitsByDay[dayKey].push({
                    repo: repoFullName,
                    message: commit.commit.message,
                    author: commit.commit.author.name,
                    date: commitDateStr,
                });
            }
        }
    }

    // Ordena os commits por data
    const sortedCommitsByDay = {};
    Object.keys(commitsByDay)
        .sort((a, b) => {
            const dateA = new Date(a.split('/').reverse().join('-'));
            const dateB = new Date(b.split('/').reverse().join('-'));
            return dateA - dateB;
        })
        .forEach((key) => {
            sortedCommitsByDay[key] = commitsByDay[key];
        });

    // Salva os commits em um arquivo JSON
    const outputFile = 'commits.json';
    fs.writeFileSync(outputFile, JSON.stringify(sortedCommitsByDay, null, 2));
    console.log(`Commits salvos em ${outputFile}`);
}

main().catch((error) => console.error('Erro:', error));