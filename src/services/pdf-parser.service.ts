// src/services/pdf-parser.service.ts
import fs from "fs";
import pdf from "pdf-parse";
import { logger } from "@/utils/logger";

export interface PDFParseResult {
  text: string;
  pages: number;
  info: {
    Title?: string;
    Author?: string;
    Subject?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: Date;
  };
  metadata: any;
}

export class PDFParserService {
  /**
   * Parse PDF file and extract text
   */
  async parsePDF(filePath: string): Promise<PDFParseResult> {
    try {
      logger.info("Parsing PDF file", { filePath });

      // Read PDF file
      const dataBuffer = fs.readFileSync(filePath);

      // Parse PDF
      const data = await pdf(dataBuffer);

      logger.success("PDF parsed successfully", {
        pages: data.numpages,
        textLength: data.text.length,
      });

      return {
        text: data.text,
        pages: data.numpages,
        info: {
          Title: data.info?.Title,
          Author: data.info?.Author,
          Subject: data.info?.Subject,
          Creator: data.info?.Creator,
          Producer: data.info?.Producer,
          CreationDate: data.info?.CreationDate,
        },
        metadata: data.metadata,
      };
    } catch (error: any) {
      logger.error("Failed to parse PDF", error);
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF and clean it
   */
  async extractText(filePath: string): Promise<string> {
    const result = await this.parsePDF(filePath);
    return this.cleanText(result.text);
  }

  /**
   * Clean extracted text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\n{3,}/g, "\n\n") // Remove excessive newlines
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/^\s+|\s+$/gm, "") // Trim lines
      .trim();
  }

  /**
   * Check if file is a valid PDF
   */
  async isValidPDF(filePath: string): Promise<boolean> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      // PDF files start with %PDF
      const header = dataBuffer.toString("utf8", 0, 5);
      return header === "%PDF-";
    } catch (error) {
      return false;
    }
  }

  /**
   * Get PDF metadata without full parsing
   */
  async getMetadata(filePath: string): Promise<any> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer, {
        max: 1, // Only parse first page for metadata
      });
      return {
        pages: data.numpages,
        info: data.info,
        version: data.version,
      };
    } catch (error) {
      logger.error("Failed to get PDF metadata", error);
      return null;
    }
  }

  /**
   * Extract text from specific pages
   */
  async extractPages(
    filePath: string,
    _pageNumbers: number[],
  ): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);

      // Note: pdf-parse returns all text, we'd need a more advanced
      // library for page-specific extraction
      logger.warn(
        "Page-specific extraction not fully supported, returning all text",
      );

      return this.cleanText(data.text);
    } catch (error: any) {
      logger.error("Failed to extract pages", error);
      throw new Error(`Page extraction failed: ${error.message}`);
    }
  }

  /**
   * Get word count from PDF
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
}

// Singleton
let pdfParserService: PDFParserService | null = null;

export function getPDFParserService(): PDFParserService {
  if (!pdfParserService) {
    pdfParserService = new PDFParserService();
  }
  return pdfParserService;
}

export default getPDFParserService;
