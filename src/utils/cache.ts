import fs from 'node:fs';
import path from 'node:path';

export class FileCache {
  static saveJson<T>(filePath: string, data: T): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  static loadJson<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  static exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  static getStats(filePath: string): { exists: boolean; sizeBytes?: number; mtime?: Date } {
    if (!fs.existsSync(filePath)) {
      return { exists: false };
    }
    const stat = fs.statSync(filePath);
    return {
      exists: true,
      sizeBytes: stat.size,
      mtime: stat.mtime,
    };
  }
}
