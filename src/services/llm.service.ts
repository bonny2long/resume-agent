// src/services/llm.service.ts
import Anthropic from "@anthropic-ai/sdk";
import { CohereClient, CohereClientV2 } from "cohere-ai";
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
  private anthropicClient?: Anthropic;
  private cohereClient?: CohereClient;
  private cohereClientV2?: CohereClientV2;
  private provider: "anthropic" | "cohere";
  private model: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor() {
    this.provider = this.detectProvider();
    this.initializeClients();
    this.model = config.llm.model;
    this.defaultMaxTokens = config.llm.maxTokens;
    this.defaultTemperature = config.llm.temperature;

    logger.debug("LLM Service initialized", {
      provider: this.provider,
      model: this.model,
      maxTokens: this.defaultMaxTokens,
      temperature: this.defaultTemperature,
    });
  }

  private detectProvider(): "anthropic" | "cohere" {
    // Prefer Anthropic if available
    if (config.llm.apiKey || process.env.ANTHROPIC_API_KEY) {
      return "anthropic";
    }
    // Fallback to Cohere
    if (process.env.COHERE_API_KEY) {
      return "cohere";
    }

    throw new Error(
      "No LLM API key found. Please set ANTHROPIC_API_KEY or COHERE_API_KEY",
    );
  }

  private initializeClients(): void {
    // Initialize Anthropic if key is available
    const anthropicKey = config.llm.apiKey || process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
    }

    // Initialize Cohere if key is available
    const cohereKey = process.env.COHERE_API_KEY;
    if (cohereKey) {
      this.cohereClient = new CohereClient({
        token: cohereKey,
      });
      this.cohereClientV2 = new CohereClientV2({
        token: cohereKey,
      });
    }
  }

  /**
   * Simple completion with fallback
   */
  async complete(
    prompt: string,
    options: CompletionOptions = {},
  ): Promise<AgentResponse<string>> {
    const startTime = Date.now();

    try {
      logger.debug("Sending completion request", {
        promptLength: prompt.length,
        provider: this.provider,
        ...options,
      });

      let response: any;
      let content: string;
      let tokensUsed = 0;

      // Try primary provider first
      if (this.provider === "anthropic" && this.anthropicClient) {
        response = await this.anthropicClient.messages.create({
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

        content = this.extractTextContent(response);
        tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
      }
      // Try Cohere
      else if (this.provider === "cohere" && this.cohereClientV2) {
        const chatMessages: any[] = [];
        if (options.systemPrompt) {
          chatMessages.push({ role: "system", content: options.systemPrompt });
        }
        chatMessages.push({ role: "user", content: prompt });

        response = await this.cohereClientV2.chat({
          model: "command-a-03-2025",
          messages: chatMessages,
          maxTokens: options.maxTokens || this.defaultMaxTokens,
          temperature: options.temperature || this.defaultTemperature,
        });

        const contentItem = response.message?.content?.[0];
        content = contentItem?.type === "text" ? contentItem.text : "";
        tokensUsed =
          (response.meta?.billedUnits?.inputTokens || 0) +
          (response.meta?.billedUnits?.outputTokens || 0);
      } else {
        throw new Error(`No client available for provider: ${this.provider}`);
      }

      const duration = Date.now() - startTime;

      logger.debug("Completion successful", {
        responseLength: content.length,
        duration,
        tokensUsed,
      });

      return {
        success: true,
        data: content,
        metadata: {
          tokensUsed,
          duration,
        },
      };
    } catch (error: any) {
      logger.error("Completion failed", error);

      // Try fallback if primary fails
      if (this.provider === "anthropic" && this.cohereClient) {
        logger.info("Falling back to Cohere");
        return this.completeWithCohere(prompt, options);
      } else if (this.provider === "cohere" && this.anthropicClient) {
        logger.info("Falling back to Anthropic");
        return this.completeWithAnthropic(prompt, options);
      }

      return {
        success: false,
        error: error.message || "Unknown error occurred",
      };
    }
  }

  private async completeWithAnthropic(
    prompt: string,
    options: CompletionOptions = {},
  ): Promise<AgentResponse<string>> {
    if (!this.anthropicClient) {
      throw new Error("Anthropic client not available");
    }

    const response = await this.anthropicClient.messages.create({
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

    const content = this.extractTextContent(response);

    return {
      success: true,
      data: content,
      metadata: {
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        provider: "anthropic-fallback",
      },
    };
  }

  private async completeWithCohere(
    prompt: string,
    options: CompletionOptions = {},
  ): Promise<AgentResponse<string>> {
    if (!this.cohereClient) {
      throw new Error("Cohere client not available");
    }

    const chatMessages: any[] = [];
    if (options.systemPrompt) {
      chatMessages.push({ role: "system", content: options.systemPrompt });
    }
    chatMessages.push({ role: "user", content: prompt });

    const response = await this.cohereClientV2!.chat({
      model: "command-a-03-2025",
      messages: chatMessages,
      maxTokens: options.maxTokens || this.defaultMaxTokens,
      temperature: options.temperature || this.defaultTemperature,
    });

    const contentItem = response.message?.content?.[0];
    const content = contentItem?.type === "text" ? contentItem.text : "";

    return {
      success: true,
      data: content,
      metadata: {
        tokensUsed: 1000, // Estimate for Cohere fallback
        provider: "cohere-fallback",
      },
    };
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
        provider: this.provider,
        ...options,
      });

      let response: any;
      let content: string;
      let tokensUsed = 0;

      if (this.provider === "anthropic" && this.anthropicClient) {
        response = await this.anthropicClient.messages.create({
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

        content = this.extractTextContent(response);
        tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
      } else if (this.provider === "cohere" && this.cohereClientV2) {
        const chatMessages: any[] = [];
        if (options.systemPrompt) {
          chatMessages.push({ role: "system", content: options.systemPrompt });
        }
        chatMessages.push(
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        );

        response = await this.cohereClientV2.chat({
          model: "command-a-03-2025",
          messages: chatMessages,
          maxTokens: options.maxTokens || this.defaultMaxTokens,
          temperature: options.temperature || this.defaultTemperature,
        });

        const contentItem = response.message?.content?.[0];
        content = contentItem?.type === "text" ? contentItem.text : "";
        tokensUsed =
          (response.usage?.inputTokens || 0) +
          (response.usage?.outputTokens || 0);
      } else {
        throw new Error(`No client available for provider: ${this.provider}`);
      }

      const duration = Date.now() - startTime;

      logger.debug("Chat successful", {
        responseLength: content.length,
        duration,
        tokensUsed,
      });

      return {
        success: true,
        data: content,
        metadata: {
          tokensUsed,
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
      provider: this.provider,
      model: this.model,
      maxTokens: this.defaultMaxTokens,
      temperature: this.defaultTemperature,
      hasAnthropic: !!this.anthropicClient,
      hasCohere: !!this.cohereClient,
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
