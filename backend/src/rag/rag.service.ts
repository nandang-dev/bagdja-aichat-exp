import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PDFParse } from 'pdf-parse';

type IndexItem = {
  id: string;
  appId: string;
  file: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
};

type ScoredIndexItem = IndexItem & {
  score: number;
};

type DocumentInfo = {
  filename: string;
  size: number;
  updatedAt: string;
};

@Injectable()
export class RagService {
  private readonly ollamaBaseUrl = 'http://localhost:11434';
  private readonly embedModel = 'embeddinggemma';
  private readonly chatModel = 'qwen2.5:7b';

  private readonly docsRootDir = path.join(process.cwd(), 'docs');
  private readonly dataDir = path.join(process.cwd(), 'data');

  private ensureBaseDirs() {
    if (!fs.existsSync(this.docsRootDir)) {
      fs.mkdirSync(this.docsRootDir, { recursive: true });
    }

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private validateAppId(appId: string) {
    if (!appId || !/^[a-zA-Z0-9-_]+$/.test(appId)) {
      throw new BadRequestException(
        'appId wajib diisi dan hanya boleh berisi huruf, angka, dash, underscore',
      );
    }
  }

  private getAllowedExtensions() {
    return ['.txt', '.pdf'];
  }

  private isAllowedFile(filename: string) {
    const ext = path.extname(filename).toLowerCase();
    return this.getAllowedExtensions().includes(ext);
  }

  private validateFilename(filename: string) {
    if (!filename || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Filename tidak valid');
    }

    if (!this.isAllowedFile(filename)) {
      throw new BadRequestException('Hanya file .txt dan .pdf yang diizinkan');
    }
  }

  private getAppDocsDir(appId: string) {
    this.validateAppId(appId);
    return path.join(this.docsRootDir, appId);
  }

  private getIndexPath(appId: string) {
    this.validateAppId(appId);
    return path.join(this.dataDir, `${appId}_index.json`);
  }

  private ensureAppDocsDir(appId: string) {
    const appDocsDir = this.getAppDocsDir(appId);

    if (!fs.existsSync(appDocsDir)) {
      fs.mkdirSync(appDocsDir, { recursive: true });
    }

    return appDocsDir;
  }

  private chunkText(text: string, chunkSize = 800, overlap = 150): string[] {
    const clean = text.replace(/\s+/g, ' ').trim();
    const chunks: string[] = [];

    let start = 0;
    while (start < clean.length) {
      const end = Math.min(start + chunkSize, clean.length);
      const chunk = clean.slice(start, end).trim();

      if (chunk) {
        chunks.push(chunk);
      }

      if (end === clean.length) {
        break;
      }

      start += chunkSize - overlap;
    }

    return chunks;
  }

  private async ollamaEmbed(text: string): Promise<number[]> {
    const response = await fetch(`${this.ollamaBaseUrl}/api/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.embedModel,
        input: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new InternalServerErrorException(`Embed failed: ${errorText}`);
    }

    const data = await response.json();
    return data.embeddings[0];
  }

  private loadIndex(appId: string): IndexItem[] {
    const indexPath = this.getIndexPath(appId);

    if (!fs.existsSync(indexPath)) {
      return [];
    }

    return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async extractTextFromFile(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.txt') {
      return fs.readFileSync(filePath, 'utf8');
    }

    if (ext === '.pdf') {
      const buffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return result.text || '';
      } finally {
        await parser.destroy();
      }
    }

    throw new BadRequestException('Format file tidak didukung');
  }

  listDocuments(appId: string): DocumentInfo[] {
    this.ensureBaseDirs();
    const appDocsDir = this.ensureAppDocsDir(appId);

    const files = fs
      .readdirSync(appDocsDir)
      .filter((file) => this.isAllowedFile(file));

    return files.map((filename) => {
      const fullPath = path.join(appDocsDir, filename);
      const stat = fs.statSync(fullPath);

      return {
        filename,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
      };
    });
  }

  saveDocument(appId: string, filename: string, buffer: Buffer) {
    this.ensureBaseDirs();
    this.validateFilename(filename);

    const appDocsDir = this.ensureAppDocsDir(appId);
    const filePath = path.join(appDocsDir, filename);

    fs.writeFileSync(filePath, buffer);

    return {
      message: 'File uploaded',
      appId,
      filename,
    };
  }

  replaceDocument(appId: string, filename: string, buffer: Buffer) {
    this.ensureBaseDirs();
    this.validateFilename(filename);

    const appDocsDir = this.ensureAppDocsDir(appId);
    const filePath = path.join(appDocsDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File tidak ditemukan');
    }

    fs.writeFileSync(filePath, buffer);

    return {
      message: 'File replaced',
      appId,
      filename,
    };
  }

  deleteDocument(appId: string, filename: string) {
    this.ensureBaseDirs();
    this.validateFilename(filename);

    const appDocsDir = this.ensureAppDocsDir(appId);
    const filePath = path.join(appDocsDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File tidak ditemukan');
    }

    fs.unlinkSync(filePath);

    return {
      message: 'File deleted',
      appId,
      filename,
    };
  }

  async buildIndex(appId: string) {
    this.ensureBaseDirs();

    const appDocsDir = this.ensureAppDocsDir(appId);
    const files = fs
      .readdirSync(appDocsDir)
      .filter((file) => this.isAllowedFile(file));

    if (files.length === 0) {
      throw new InternalServerErrorException(
        `Tidak ada file .txt atau .pdf di folder docs/${appId}`,
      );
    }

    const index: IndexItem[] = [];

    for (const file of files) {
      const fullPath = path.join(appDocsDir, file);
      const extractedText = await this.extractTextFromFile(fullPath);

      if (!extractedText.trim()) {
        console.warn(`Skip file kosong / tidak terbaca: ${file}`);
        continue;
      }

      const chunks = this.chunkText(extractedText);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.ollamaEmbed(chunk);

        index.push({
          id: `${appId}-${file}-${i}`,
          appId,
          file,
          chunkIndex: i,
          text: chunk,
          embedding,
        });

        console.log(`Indexed [${appId}]: ${file} chunk ${i + 1}/${chunks.length}`);
      }
    }

    const indexPath = this.getIndexPath(appId);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');

    return {
      message: 'Index berhasil dibuat',
      appId,
      totalChunks: index.length,
      files,
    };
  }

  async searchRelevantChunks(
    appId: string,
    question: string,
    topK = 3,
  ): Promise<ScoredIndexItem[]> {
    const index = this.loadIndex(appId);

    if (index.length === 0) {
      throw new InternalServerErrorException(
        `Index kosong untuk ${appId}. Jalankan /rag/reindex dulu`,
      );
    }

    const questionEmbedding = await this.ollamaEmbed(question);

    const scored: ScoredIndexItem[] = index.map((item) => ({
      ...item,
      score: this.cosineSimilarity(questionEmbedding, item.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
  }

  async askModel(
    appId: string,
    question: string,
    contextChunks: ScoredIndexItem[],
  ) {
    const contextText = contextChunks
      .map(
        (chunk, idx) =>
          `[Sumber ${idx + 1} | ${chunk.file} | score=${chunk.score.toFixed(4)}]\n${chunk.text}`,
      )
      .join('\n\n');

    const response = await fetch(`${this.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.chatModel,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `Kamu adalah asisten AI untuk aplikasi ${appId}. Jawab hanya berdasarkan konteks dokumen yang diberikan. Jika jawaban tidak ada di konteks, jawab: "Saya tidak menemukan informasi itu di dokumen." Jangan mengarang.`,
          },
          {
            role: 'user',
            content: `App ID: ${appId}\n\nPertanyaan user:\n${question}\n\nKonteks dokumen:\n${contextText}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new InternalServerErrorException(`Chat failed: ${errorText}`);
    }

    const data = await response.json();

    return {
      appId,
      answer: data?.message?.content || '',
      sources: contextChunks.map((item) => ({
        file: item.file,
        chunkIndex: item.chunkIndex,
        score: item.score,
        text: item.text,
      })),
    };
  }

  async chat(appId: string, question: string) {
    if (!question?.trim()) {
      throw new BadRequestException('question wajib diisi');
    }

    const relevantChunks = await this.searchRelevantChunks(appId, question, 3);

    console.log('App:', appId);
    console.log('Question:', question);
    console.log(
      'Top chunks:',
      relevantChunks.map((item) => ({
        file: item.file,
        chunkIndex: item.chunkIndex,
        score: item.score,
      })),
    );

    return this.askModel(appId, question, relevantChunks);
  }
}
