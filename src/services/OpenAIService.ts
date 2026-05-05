import { OpenAICommitAnalysisInput } from "../types";
import { getFetch } from "../utils/generalUtils";

interface OpenAIServiceOptions {
  apiKey: string;
  model: string;
  instruction: string;
}

export class OpenAIService {
  private apiKey: string;
  private model: string;
  private instruction: string;
  private fetch: any;

  constructor(options: OpenAIServiceOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.instruction = options.instruction;
  }

  private async initFetch(): Promise<void> {
    if (!this.fetch) {
      this.fetch = await getFetch();
    }
  }

  public async analyzeCommits(
    input: OpenAICommitAnalysisInput
  ): Promise<string> {
    await this.initFetch();

    const response = await this.fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        instructions: this.instruction,
        input:
          "Analise os commits do GitHub usando os dados JSON abaixo.\n\n" +
          JSON.stringify(input, null, 2),
        store: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Falha ao chamar OpenAI: HTTP ${response.status} ${response.statusText} - ${body}`
      );
    }

    const data = await response.json();
    return this.extractText(data);
  }

  private extractText(data: any): string {
    if (typeof data?.output_text === "string" && data.output_text.trim()) {
      return data.output_text;
    }

    const outputText = data?.output
      ?.flatMap((item: any) => item?.content ?? [])
      ?.filter((content: any) => content?.type === "output_text")
      ?.map((content: any) => content?.text)
      ?.filter(Boolean)
      ?.join("\n");

    if (outputText?.trim()) {
      return outputText;
    }

    return JSON.stringify(data, null, 2);
  }
}
