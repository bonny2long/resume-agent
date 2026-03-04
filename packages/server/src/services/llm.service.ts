// src/services/llm.service.ts
import Anthropic from "@anthropic-ai/sdk";
import { CohereClient, CohereClientV2 } from "cohere-ai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { InferenceClient } from "@huggingface/inference";
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
  private geminiClient?: GoogleGenerativeAI;
  private huggingFaceClient?: InferenceClient;
  private provider: "anthropic" | "cohere" | "gemini" | "huggingface";
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

  private detectProvider(): "anthropic" | "cohere" | "gemini" | "huggingface" {
    const preferredProvider = (process.env.LLM_PROVIDER || "").toLowerCase().trim();
    if (preferredProvider) {
      if (preferredProvider === "huggingface" && process.env.HUGGINGFACE_API_KEY) {
        return "huggingface";
      }
      if (preferredProvider === "gemini" && process.env.GEMINI_API_KEY) {
        return "gemini";
      }
      if (preferredProvider === "anthropic" && (config.llm.apiKey || process.env.ANTHROPIC_API_KEY)) {
        return "anthropic";
      }
      if (preferredProvider === "cohere" && process.env.COHERE_API_KEY) {
        return "cohere";
      }

      logger.warn("LLM_PROVIDER is set but matching API key is missing; using auto-detection", {
        preferredProvider,
      });
    }

    // Prefer Hugging Face if available
    if (process.env.HUGGINGFACE_API_KEY) {
      return "huggingface";
    }
    // Prefer Gemini if available
    if (process.env.GEMINI_API_KEY) {
      return "gemini";
    }
    // Prefer Anthropic if available
    if (config.llm.apiKey || process.env.ANTHROPIC_API_KEY) {
      return "anthropic";
    }
    // Fallback to Cohere
    if (process.env.COHERE_API_KEY) {
      return "cohere";
    }

    throw new Error(
      "No LLM API key found. Please set HUGGINGFACE_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY or COHERE_API_KEY",
    );
  }

  private getModelForProvider(
    provider: "anthropic" | "cohere" | "gemini" | "huggingface",
  ): string {
    // Map the configured model to provider-specific models
    const configuredModel = this.model;

    switch (provider) {
      case "huggingface":
        return config.huggingface.model;

      case "gemini":
        // Prioritize a specific Gemini model from env if set
        if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;

        // Use Gemini models - fallback to gemini-2.5-flash-lite (highest free tier quota) if config has Anthropic model
        if (
          configuredModel.includes("claude") ||
          configuredModel.includes("anthropic")
        ) {
          return "gemini-2.5-flash-lite";
        }
        // Use appropriate Gemini model names
        if (configuredModel.includes("gemini")) {
          return configuredModel; // Pass through if already a gemini model name
        }
        return "gemini-2.5-flash-lite"; // 1500+ req/day on free tier

      case "anthropic":
        // Use Anthropic models
        if (configuredModel.includes("gemini")) {
          return "claude-3-5-sonnet-20240620"; // Use a valid, recent model
        }
        return configuredModel;

      case "cohere":
        // Use Cohere models
        if (
          configuredModel.includes("claude") ||
          configuredModel.includes("anthropic") ||
          configuredModel.includes("gemini")
        ) {
          return "command-r"; // Use a standard, valid model
        }
        return configuredModel.includes("command") ? configuredModel : (
            "command-r"
          );

      default:
        return configuredModel;
    }
  }

  /**
   * Retry helper with exponential backoff for rate-limit (429) errors
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const message = error?.message || "";
        const isRetryable =
          message.includes("429") ||
          message.includes("Too Many Requests") ||
          message.includes("quota") ||
          message.includes("503") || // Model loading
          message.includes("502") || // Bad Gateway
          message.includes("504"); // Gateway Timeout

        if (isRetryable && attempt < maxRetries) {
          // Extract retry delay from error message, or use exponential backoff
          const retryMatch = message.match(/retry in ([\d.]+)s/i);
          // For 503 (model loading), wait longer (20s+)
          const isModelLoading = message.includes("503");
          const baseWait = isModelLoading ? 20 : 5;

          const waitSeconds =
            retryMatch ?
              parseFloat(retryMatch[1])
            : Math.pow(2, attempt + 1) * baseWait;
          const waitMs = Math.ceil(waitSeconds * 1000);

          logger.warn(
            `Request failed (${isModelLoading ? "Model Loading" : "Rate Limit"}). Retrying in ${waitSeconds.toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})...`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw error;
      }
    }
    throw new Error("Max retries exceeded");
  }

  private initializeClients(): void {
    // Initialize Hugging Face if key is available
    const hfKey = process.env.HUGGINGFACE_API_KEY;
    if (hfKey) {
      this.huggingFaceClient = new InferenceClient(hfKey);
    }

    // Initialize Gemini if key is available
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
    }

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
      if (this.provider === "huggingface" && this.huggingFaceClient) {
        const result = await this.withRetry(() =>
          this.huggingFaceClient!.chatCompletion({
            model: this.getModelForProvider("huggingface"),
            messages: [{ role: "user", content: prompt }],
            max_tokens: options.maxTokens || this.defaultMaxTokens,
            temperature: options.temperature || this.defaultTemperature,
          }),
        );
        content = result.choices[0].message.content || "";
        tokensUsed =
          result.usage?.total_tokens || Math.ceil(content.length / 4);
      } else if (this.provider === "gemini" && this.geminiClient) {
        const geminiModel = this.getModelForProvider("gemini");
        const model = this.geminiClient.getGenerativeModel({
          model: geminiModel,
        });
        const result = await this.withRetry(() =>
          model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: options.maxTokens || this.defaultMaxTokens,
              temperature: options.temperature || this.defaultTemperature,
              stopSequences: options.stopSequences,
            },
          }),
        );

        content = result.response.text();
        tokensUsed = Math.ceil(content.length / 4); // Rough estimate
      } else if (this.provider === "anthropic" && this.anthropicClient) {
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
          model: this.getModelForProvider("cohere"),
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
      const allowAnthropicFallback =
        (process.env.ALLOW_ANTHROPIC_FALLBACK || "true").toLowerCase() !==
        "false";

      // Try fallback chain if primary fails
      const fallbackOrderByProvider: Record<
        "anthropic" | "cohere" | "gemini" | "huggingface",
        Array<"anthropic" | "cohere" | "gemini" | "huggingface">
      > = {
        huggingface: ["gemini", "cohere", "anthropic"],
        gemini: ["huggingface", "cohere", "anthropic"],
        anthropic: ["gemini", "huggingface", "cohere"],
        cohere: ["gemini", "huggingface", "anthropic"],
      };

      for (const fallbackProvider of fallbackOrderByProvider[this.provider]) {
        if (
          fallbackProvider === "anthropic" &&
          (!allowAnthropicFallback || !this.anthropicClient)
        ) {
          continue;
        }
        if (fallbackProvider === "huggingface" && !this.huggingFaceClient) {
          continue;
        }
        if (fallbackProvider === "gemini" && !this.geminiClient) {
          continue;
        }
        if (fallbackProvider === "cohere" && !this.cohereClientV2) {
          continue;
        }

        logger.info(`Falling back to ${fallbackProvider}`);
        try {
          switch (fallbackProvider) {
            case "anthropic":
              return await this.completeWithAnthropic(prompt, options);
            case "cohere":
              return await this.completeWithCohere(prompt, options);
            case "gemini":
              return await this.completeWithGemini(prompt, options);
            case "huggingface":
              return await this.completeWithHuggingFace(prompt, options);
          }
        } catch (fallbackError) {
          logger.warn(`${fallbackProvider} fallback failed`, fallbackError);
        }
      }

      return {
        success: false,
        error: error.message || "Unknown error occurred",
      };
    }
  }

  private async completeWithGemini(
    prompt: string,
    options: CompletionOptions = {},
  ): Promise<AgentResponse<string>> {
    if (!this.geminiClient) {
      throw new Error("Gemini client not available");
    }

    const geminiModel = this.getModelForProvider("gemini");
    const model = this.geminiClient.getGenerativeModel({
      model: geminiModel,
    });

    const result = await this.withRetry(() =>
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: options.maxTokens || this.defaultMaxTokens,
          temperature: options.temperature || this.defaultTemperature,
          stopSequences: options.stopSequences,
        },
      }),
    );

    const content = result.response.text();
    const tokensUsed = Math.ceil(content.length / 4);

    return {
      success: true,
      data: content,
      metadata: {
        tokensUsed,
        provider: "gemini-fallback",
      },
    };
  }

  private async completeWithAnthropic(
    prompt: string,
    options: CompletionOptions = {},
  ): Promise<AgentResponse<string>> {
    if (!this.anthropicClient) {
      throw new Error("Anthropic client not available");
    }

    const anthropicModel = this.getModelForProvider("anthropic");
    const response = await this.anthropicClient.messages.create({
      model: anthropicModel,
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

  private async completeWithHuggingFace(
    prompt: string,
    options: CompletionOptions = {},
  ): Promise<AgentResponse<string>> {
    if (!this.huggingFaceClient) {
      throw new Error("HuggingFace client not available");
    }

    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const result = await this.withRetry(() =>
      this.huggingFaceClient!.chatCompletion({
        model: this.getModelForProvider("huggingface"),
        messages,
        max_tokens: options.maxTokens || this.defaultMaxTokens,
        temperature: options.temperature || this.defaultTemperature,
      }),
    );

    const content = result.choices?.[0]?.message?.content || "";
    const tokensUsed = result.usage?.total_tokens || Math.ceil(content.length / 4);

    return {
      success: true,
      data: content,
      metadata: {
        tokensUsed,
        provider: "huggingface-fallback",
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
      model: this.getModelForProvider("cohere"),
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

      if (this.provider === "huggingface" && this.huggingFaceClient) {
        const result = await this.withRetry(() =>
          this.huggingFaceClient!.chatCompletion({
            model: this.getModelForProvider("huggingface"),
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            max_tokens: options.maxTokens || this.defaultMaxTokens,
            temperature: options.temperature || this.defaultTemperature,
          }),
        );
        content = result.choices[0].message.content || "";
        tokensUsed = result.usage?.total_tokens || 0;
      } else if (this.provider === "anthropic" && this.anthropicClient) {
        const anthropicModel = this.getModelForProvider("anthropic");
        response = await this.anthropicClient.messages.create({
          model: anthropicModel,
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
          model: this.getModelForProvider("cohere"),
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
