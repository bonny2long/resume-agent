// src/services/docx-parser.service.ts
import fs from "fs";
import mammoth from "mammoth";
import { logger } from "@/utils/logger";

export interface DOCXParseResult {
  text: string;
  html: string;
  messages: string[];
  value: string;
}

export class DOCXParserService {
  /**
   * Parse DOCX file and extract text
   */
  async parseDOCX(filePath: string): Promise<DOCXParseResult> {
    try {
      logger.info("Parsing DOCX file", { filePath });

      // Read DOCX file
      const buffer = fs.readFileSync(filePath);

      // Convert to text
      const textResult = await mammoth.extractRawText({ buffer });

      // Also convert to HTML for better formatting
      const htmlResult = await mammoth.convertToHtml({ buffer });

      logger.success("DOCX parsed successfully", {
        textLength: textResult.value.length,
        messages: textResult.messages.length,
      });

      // Log any conversion messages/warnings
      if (textResult.messages.length > 0) {
        logger.warn("DOCX conversion messages", {
          messages: textResult.messages.map((m) => m.message),
        });
      }

      return {
        text: textResult.value,
        html: htmlResult.value,
        messages: textResult.messages.map((m) => m.message),
        value: textResult.value,
      };
    } catch (error: any) {
      logger.error("Failed to parse DOCX", error);
      throw new Error(`DOCX parsing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from DOCX and clean it
   */
  async extractText(filePath: string): Promise<string> {
    const result = await this.parseDOCX(filePath);
    return this.cleanText(result.text);
  }

  /**
   * Extract HTML from DOCX (preserves some formatting)
   */
  async extractHTML(filePath: string): Promise<string> {
    try {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.convertToHtml({ buffer });
      return result.value;
    } catch (error: any) {
      logger.error("Failed to extract HTML from DOCX", error);
      throw new Error(`HTML extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract with custom style mapping
   */
  async extractWithStyles(filePath: string): Promise<DOCXParseResult> {
    try {
      const buffer = fs.readFileSync(filePath);

      // Custom style mapping for better extraction
      const options = {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Title'] => h1.title:fresh",
          "p[style-name='Subtitle'] => h2.subtitle:fresh",
          'r[style-name="Strong"] => strong',
          'r[style-name="Emphasis"] => em',
        ],
      };

      const textResult = await mammoth.extractRawText({ buffer });
      const htmlResult = await mammoth.convertToHtml({ buffer, ...options });

      return {
        text: textResult.value,
        html: htmlResult.value,
        messages: textResult.messages.map((m) => m.message),
        value: textResult.value,
      };
    } catch (error: any) {
      logger.error("Failed to parse DOCX with styles", error);
      throw new Error(`Styled parsing failed: ${error.message}`);
    }
  }

  /**
   * Clean extracted text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\n{3,}/g, "\n\n") // Remove excessive newlines
      .replace(/\t+/g, " ") // Replace tabs with spaces
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/^\s+|\s+$/gm, "") // Trim lines
      .trim();
  }

  /**
   * Check if file is a valid DOCX
   */
  async isValidDOCX(filePath: string): Promise<boolean> {
    try {
      const buffer = fs.readFileSync(filePath);
      // DOCX files are ZIP archives, check for PK header
      const header = buffer.toString("utf8", 0, 2);
      return header === "PK";
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract images from DOCX (if any)
   */
  async extractImages(filePath: string): Promise<Buffer[]> {
    try {
      const buffer = fs.readFileSync(filePath);

      const images: Buffer[] = [];

      const options = {
        convertImage: mammoth.images.imgElement(async (element: any) => {
          const imageBuffer = await element.read();
          images.push(imageBuffer);
          return { src: "" }; // We're just collecting images, not converting
        }),
      };

      await mammoth.convertToHtml({ buffer, ...options });

      logger.info(`Extracted ${images.length} images from DOCX`);

      return images;
    } catch (error: any) {
      logger.error("Failed to extract images", error);
      return [];
    }
  }

  /**
   * Get word count from DOCX
   */
  async getWordCount(filePath: string): Promise<number> {
    const text = await this.extractText(filePath);
    const words = text.split(/\s+/).filter((word) => word.length > 0);
    return words.length;
  }

  /**
   * Get file size in bytes
   */
  getFileSize(filePath: string): number {
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Extract metadata (basic)
   */
  async getMetadata(filePath: string): Promise<{
    fileSize: number;
    fileSizeFormatted: string;
    wordCount: number;
  }> {
    const fileSize = this.getFileSize(filePath);
    const wordCount = await this.getWordCount(filePath);

    return {
      fileSize,
      fileSizeFormatted: this.formatFileSize(fileSize),
      wordCount,
    };
  }
}

// Singleton
let docxParserService: DOCXParserService | null = null;

export function getDOCXParserService(): DOCXParserService {
  if (!docxParserService) {
    docxParserService = new DOCXParserService();
  }
  return docxParserService;
}

export default getDOCXParserService;
