<p align="center">
  <img src="logo.png" alt="GitHub Commits" width="420">
</p>

<h1 align="center">GitHub Commits</h1>

<p align="center">
  Generate clean GitHub commit reports and turn them into AI-written summaries.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-18%2B-green" alt="Node.js">
  <img src="https://img.shields.io/badge/license-MIT-lightgrey" alt="License">
</p>

## Features

- **GitHub reports** - Collect commits from GitHub users or organizations
- **AI summaries** - Send the collected data to OpenAI with your own instruction
- **Flexible periods** - Use today, last N days, or a specific month/year
- **Branch control** - Read only the default branch or all branches
- **User filtering** - Report one target user or everyone in the account
- **Structured output** - Save JSON files plus a Markdown AI response
- **Duplicate protection** - Deduplicate commits by SHA across branches

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the project root:

```env
GITHUB_TOKEN=your_github_token
ORG_NAME=your_org_or_user
TARGET_USER=github_username

OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5-nano
OPENAI_INSTRUCTION=me de uma lista do que foi feito por dia, por linha, em pt br, ignore os merge, deixa assim ex: feat: foi feito tal tal tal. fix: ....
```

Required variables:

- `GITHUB_TOKEN` - GitHub token with access to the target repositories
- `ORG_NAME` or `ACCOUNT` - GitHub organization or user account
- `OPENAI_API_KEY` - OpenAI API key
- `OPENAI_INSTRUCTION` - Instruction used to generate the AI report

Optional variables:

- `TARGET_USER` - Required unless you run with `--all-users`
- `OPENAI_MODEL` - Defaults to `gpt-5-nano`
- `OPENAI_OUTPUT_FILE` - Custom path for the AI response file
- `OUT_DIR` - Output directory, defaults to `./output`
- `MONTH`, `YEAR`, `LAST_DAYS`, `TODAY_ONLY`
- `ALL_BRANCHES`, `MAIN_ONLY`, `ALL_USERS`
- `QUIET`, `NO_RAW`

## Basic Usage

```bash
npm start
```

The default run collects commits for the current month using `TARGET_USER`, writes JSON files, calls OpenAI, and saves the AI response as Markdown.

## Examples

```bash
# Today's commits
npm start -- --today

# Last 7 days, all users
npm start -- --last-days=7 --all-users

# Current month, all branches
npm start -- --all-branches

# Specific month
npm start -- --month=1 --year=2026

# Custom output directory
npm start -- --today --out-dir=./reports

# Quiet mode without raw GitHub payload
npm start -- --last-days=15 --quiet --no-raw
```

## CLI Options

### Period

- `--today` - Use only today's commits
- `--last-days=N` - Use the last N days, including today
- `--month=MM` - Month number from 1 to 12
- `--year=YYYY` - Year for monthly reports

Precedence is `--today` > `--last-days` > `--month/--year`.

### Branches

- `--main-only` - Process only the repository default branch
- `--all-branches` - Process every branch

### Users

- `--all-users` - Include commits from all users

Without `--all-users`, the report only includes `TARGET_USER`.

### Output

- `--out-dir=PATH` - Base output directory
- `--no-raw` - Do not save the raw GitHub API payload
- `--quiet` - Reduce console logs
- `--help` or `-h` - Show CLI help

## Output

Files are saved under `output/YYYY/MM/` by default:

- `commits_by_day_YYYY_MM.json` - Commits grouped by day and repository
- `ranking_YYYY_MM.json` - Commit count by author
- `raw_commits_YYYY_MM.json` - Raw GitHub API commits, unless `--no-raw` is used
- `commits_USER_YYYY_MM.json` - Target user commits, when `TARGET_USER` is used
- `openai_response_YYYY_MM.md` - OpenAI-generated report

Example AI output for a daily report:

```md
## 05/05/2026

- feat: foi criada a integracao com a API da OpenAI.
- fix: foi ajustado o arquivo de saida do resumo.
```

## OpenAI

The project uses the OpenAI Responses API and sends a compact JSON payload containing:

- account name
- selected period
- branch and user scope
- commit ranking
- commits grouped by day
- collection statistics

`gpt-5-nano` is the default model because this workflow is mostly summarization and formatting.

## Development

```bash
# Type-check the project
npx tsc --noEmit

# Show all CLI options
npm start -- --help
```

## Troubleshooting

- `GITHUB_TOKEN` errors usually mean the token is missing, expired, or lacks repository access.
- `TARGET_USER` is required unless you pass `--all-users`.
- `OPENAI_API_KEY` and `OPENAI_INSTRUCTION` are required before the OpenAI step can run.
- Empty reports usually mean no repositories were active in the selected period, or commits are on non-default branches. Try `--all-branches`.

## Contributing

Contributions are welcome. Please keep changes focused, run the TypeScript check, and include a short description of the behavior being changed.

## License

MIT
