import fs from 'fs/promises';
import path from 'path';
import chokidar, { type FSWatcher } from 'chokidar';
import type { Logger } from 'pino';

export interface Frame {
  id: number;
  path: string;
  timestamp: number;
  size: number;
}

export class StreamManager {
  private frames: Map<number, Frame> = new Map();
  private latestFrameId: number = -1;
  private watcher: FSWatcher | null = null;
  
  constructor(
    private logger: Logger,
    private config: { directory: string; pollInterval: number; format: string }
  ) {
    this.initializeWatcher().catch(err => 
      this.logger.error({ error: err }, 'Failed to initialize watcher')
    );
  }
  
  private async initializeWatcher(): Promise<void> {
    // Check if directory exists first
    try {
      const stats = await fs.stat(this.config.directory);
      if (!stats.isDirectory()) {
        this.logger.error({ directory: this.config.directory }, 'Frame directory is not a directory');
        return;
      }
    } catch (error) {
      this.logger.error({ directory: this.config.directory, error }, 'Frame directory does not exist');
      // Try to create it
      try {
        await fs.mkdir(this.config.directory, { recursive: true });
        this.logger.info({ directory: this.config.directory }, 'Created frame directory');
      } catch (mkdirError) {
        this.logger.error({ directory: this.config.directory, error: mkdirError }, 'Failed to create frame directory');
        return;
      }
    }
    
    const pattern = path.join(this.config.directory, `*.${this.config.format}`);
    
    this.watcher = chokidar.watch(pattern, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });
    
    this.watcher
      .on('add', (filePath: string) => this.handleNewFrame(filePath))
      .on('change', (filePath: string) => this.handleFrameChange(filePath))
      .on('unlink', (filePath: string) => this.handleFrameRemoval(filePath))
      .on('error', (error: unknown) => this.logger.error({ error }, 'Watcher error'));
    
    this.logger.info({ 
      directory: this.config.directory,
      resolvedPath: path.resolve(this.config.directory),
      pattern: pattern 
    }, 'Frame watcher initialized');

    // Seed existing frames immediately so APIs have data before the first change event
    (async () => {
      try {
        const files = (await fs.readdir(this.config.directory))
          .filter(f => f.endsWith(`.${this.config.format}`))
          .sort();
        for (const f of files) {
          await this.handleNewFrame(path.join(this.config.directory, f));
        }
        this.logger.info({ count: this.frames.size, latestId: this.latestFrameId }, 'Seeded existing frames');
      } catch (e) {
        this.logger.error({ error: e, directory: this.config.directory }, 'Failed to seed frames from directory');
      }
    })();
  }
  
  private async handleNewFrame(filePath: string): Promise<void> {
    try {
      const frameId = this.extractFrameId(filePath);
      if (frameId === null) return;
      
      const stats = await fs.stat(filePath);
      const frame: Frame = {
        id: frameId,
        path: filePath,
        timestamp: stats.mtimeMs,
        size: stats.size
      };
      
      this.frames.set(frameId, frame);
      if (frameId > this.latestFrameId) {
        this.latestFrameId = frameId;
        this.logger.info({ frameId, path: filePath, size: stats.size }, 'New frame detected');
      }
    } catch (error) {
      this.logger.error({ error, path: filePath }, 'Failed to process new frame');
    }
  }
  
  private async handleFrameChange(filePath: string): Promise<void> {
    await this.handleNewFrame(filePath);
  }
  
  private handleFrameRemoval(filePath: string): void {
    const frameId = this.extractFrameId(filePath);
    if (frameId !== null) {
      this.frames.delete(frameId);
      this.logger.debug({ frameId }, 'Frame removed');
    }
  }
  
  private extractFrameId(filePath: string): number | null {
    const basename = path.basename(filePath);
    const match = basename.match(/frame_(\d+)\.\w+$/);
    return match ? parseInt(match[1], 10) : null;
  }
  
  async getLatestFrame(): Promise<Buffer | null> {
    if (this.latestFrameId < 0) return null;
    
    const frame = this.frames.get(this.latestFrameId);
    if (!frame) return null;
    
    try {
      return await fs.readFile(frame.path);
    } catch (error) {
      this.logger.error({ error, frameId: this.latestFrameId }, 'Failed to read frame');
      return null;
    }
  }
  
  async getFrame(frameId: number): Promise<Buffer | null> {
    const frame = this.frames.get(frameId);
    if (!frame) return null;
    
    try {
      return await fs.readFile(frame.path);
    } catch (error) {
      this.logger.error({ error, frameId }, 'Failed to read frame');
      return null;
    }
  }
  
  getFrameInfo(frameId: number): Frame | undefined {
    return this.frames.get(frameId);
  }
  
  getAllFrames(): Frame[] {
    return Array.from(this.frames.values()).sort((a, b) => a.id - b.id);
  }
  
  getLatestFrameId(): number {
    return this.latestFrameId;
  }
  
  cleanup(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.frames.clear();
  }
}
