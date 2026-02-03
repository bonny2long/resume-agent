// src/services/llm.service.ts
import Anthropic from "@anthropic-ai/sdk";
import config from "@/config";
import { logger } from "@/utils/logger";
import { AgentResponse } from "@/types";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  stopSequences?: string[];
}

export interface ChatOptions extends CompletionOptions {
  conversationHistory?: Message[];
}

export class LLMService {
  private client: Anthropic;
  private model: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor() {
    if (!config.llm.apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required");
    }

    this.client = new Anthropic({
      apiKey: config.llm.apiKey,
    });

    this.model = config.llm.model;
    this.defaultMaxTokens = config.llm.maxTokens;
    this.defaultTemperature = config.llm.temperature;

    logger.debug("LLM Service initialized", {
      model: this.model,
      maxTokens: this.defaultMaxTokens,
      temperature: this.defaultTemperature,
    });
  }

  /**
   * Simple completion with a single prompt
   */
  async complete(
    prompt: string,
    options: CompletionOptions = {},
  ): Promise<AgentResponse<string>> {
    const startTime = Date.now();

    try {
      logger.debug("Sending completion request", {
        promptLength: prompt.length,
        ...options,
      });

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options.maxTokens || this.defaultMaxTokens,
        temperature: options.temperature || this.defaultTemperature,
        system: options.systemPrompt,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        stop_sequences: options.stopSequences,
      });

      const duration = Date.now() - startTime;
      const content = this.extractTextContent(response);

      logger.debug("Completion successful", {
        responseLength: content.length,
        duration,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      });

      return {
        success: true,
        data: content,
        metadata: {
          tokensUsed:
            response.usage.input_tokens + response.usage.output_tokens,
          duration,
        },
      };
    } catch (error: any) {
      logger.error("Completion failed", error);
      return {
        success: false,
        error: error.message || "Unknown error occurred",
      };
    }
  }

  /**
   * Multi-turn conversation
   */
  async chat(
    messages: Message[],
    options: ChatOptions = {},
  ): Promise<AgentResponse<string>> {
    const startTime = Date.now();

    try {
      logger.debug("Sending chat request", {
        messageCount: messages.length,
        ...options,
      });

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options.maxTokens || this.defaultMaxTokens,
        temperature: options.temperature || this.defaultTemperature,
        system: options.systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stop_sequences: options.stopSequences,
      });

      const duration = Date.now() - startTime;
      const content = this.extractTextContent(response);

      logger.debug("Chat successful", {
        responseLength: content.length,
        duration,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      });

      return {
        success: true,
        data: content,
        metadata: {
          tokensUsed:
            response.usage.input_tokens + response.usage.output_tokens,
          duration,
        },
      };
    } catch (error: any) {
      logger.error("Chat failed", error);
      return {
        success: false,
        error: error.message || "Unknown error occurred",
      };
    }
  }

  /**
   * Structured output - ask for JSON response
   */
  async completeJSON<T>(
    prompt: string,
    options: CompletionOptions = {},
  ): Promise<AgentResponse<T>> {
    const jsonPrompt = `${prompt}\n\nRespond ONLY with valid JSON. Do not include any markdown formatting or explanatory text.`;

    const response = await this.complete(jsonPrompt, {
      ...options,
      temperature: 0.3, // Lower temperature for more deterministic JSON
    });

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || "No response data",
      };
    }

    try {
      // Try to extract JSON from potential markdown code blocks
      let jsonStr = response.data.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/```\n?/g, "").replace(/```\n?$/g, "");
      }

      const parsed = JSON.parse(jsonStr);

      return {
        success: true,
        data: parsed,
        metadata: response.metadata,
      };
    } catch (error: any) {
      logger.error("Failed to parse JSON response", {
        error: error.message,
        response: response.data?.substring(0, 500),
      });

      return {
        success: false,
        error: `Failed to parse JSON: ${error.message}`,
      };
    }
  }

  /**
   * Extract text content from Claude response
   */
  private extractTextContent(response: Anthropic.Message): string {
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );

    return textBlocks.map((block) => block.text).join("\n");
  }

  /**
   * Count tokens (approximate)
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Get model info
   */
  getModelInfo() {
    return {
      model: this.model,
      maxTokens: this.defaultMaxTokens,
      temperature: this.defaultTemperature,
    };
  }
}

// Singleton instance
let llmService: LLMService;

export function getLLMService(): LLMService {
  if (!llmService) {
    llmService = new LLMService();
  }
  return llmService;
}

export default getLLMService;
