import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DockerService } from '../docker/docker.service';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: Date;
  permissions?: string;
}

export interface EditFileDto {
  content: string;
}

@Injectable()
export class FileManagerService {
  private readonly logger = new Logger(FileManagerService.name);

  constructor(
    private prisma: PrismaService,
    private dockerService: DockerService,
  ) {}

  /**
   * List files in server directory
   */
  async listFiles(userId: string, serverId: string, relativePath = '/'): Promise<FileInfo[]> {
    const server = await this.validateServerAccess(userId, serverId);
    
    if (!server.serverPath) {
      throw new BadRequestException('Server path not configured');
    }

    const fullPath = this.buildSafePath(server.serverPath, relativePath);
    
    try {
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      const files: FileInfo[] = [];

      for (const item of items) {
        const itemPath = path.join(fullPath, item.name);
        const stats = await fs.stat(itemPath);
        
        files.push({
          name: item.name,
          path: path.join(relativePath, item.name).replace(/\\\\/g, '/'),
          isDirectory: item.isDirectory(),
          size: stats.size,
          modified: stats.mtime,
          permissions: this.getPermissions(stats.mode),
        });
      }

      return files.sort((a, b) => {
        // Directories first, then files, both alphabetically
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      this.logger.error(`Failed to list files for server ${serverId} at path ${relativePath}`, error);
      throw new BadRequestException('Failed to read directory');
    }
  }

  /**
   * Read file content
   */
  async readFile(userId: string, serverId: string, filePath: string): Promise<string> {
    const server = await this.validateServerAccess(userId, serverId);
    
    if (!server.serverPath) {
      throw new BadRequestException('Server path not configured');
    }

    const fullPath = this.buildSafePath(server.serverPath, filePath);
    
    try {
      // Check if file exists and is not a directory
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        throw new BadRequestException('Cannot read directory as file');
      }

      // Check file size (limit to 10MB for text editing)
      if (stats.size > 10 * 1024 * 1024) {
        throw new BadRequestException('File too large to edit (max 10MB)');
      }

      const content = await fs.readFile(fullPath, 'utf8');
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException('File not found');
      }
      this.logger.error(`Failed to read file ${filePath} for server ${serverId}`, error);
      throw new BadRequestException('Failed to read file');
    }
  }

  /**
   * Write file content
   */
  async writeFile(userId: string, serverId: string, filePath: string, editDto: EditFileDto): Promise<void> {
    const server = await this.validateServerAccess(userId, serverId);
    
    if (!server.serverPath) {
      throw new BadRequestException('Server path not configured');
    }

    const fullPath = this.buildSafePath(server.serverPath, filePath);
    
    try {
      // Ensure directory exists
      await fs.ensureDir(path.dirname(fullPath));
      
      // Write file content
      await fs.writeFile(fullPath, editDto.content, 'utf8');
      
      this.logger.log(`File updated: ${filePath} for server ${serverId}`);
    } catch (error) {
      this.logger.error(`Failed to write file ${filePath} for server ${serverId}`, error);
      throw new BadRequestException('Failed to write file');
    }
  }

  /**
   * Create directory
   */
  async createDirectory(userId: string, serverId: string, dirPath: string): Promise<void> {
    const server = await this.validateServerAccess(userId, serverId);
    
    if (!server.serverPath) {
      throw new BadRequestException('Server path not configured');
    }

    const fullPath = this.buildSafePath(server.serverPath, dirPath);
    
    try {
      await fs.ensureDir(fullPath);
      this.logger.log(`Directory created: ${dirPath} for server ${serverId}`);
    } catch (error) {
      this.logger.error(`Failed to create directory ${dirPath} for server ${serverId}`, error);
      throw new BadRequestException('Failed to create directory');
    }
  }

  /**
   * Delete file or directory
   */
  async deleteItem(userId: string, serverId: string, itemPath: string): Promise<void> {
    const server = await this.validateServerAccess(userId, serverId);
    
    if (!server.serverPath) {
      throw new BadRequestException('Server path not configured');
    }

    const fullPath = this.buildSafePath(server.serverPath, itemPath);
    
    // Prevent deletion of critical files
    const fileName = path.basename(itemPath).toLowerCase();
    const criticalFiles = ['server.jar', 'server.properties', 'eula.txt'];
    
    if (criticalFiles.includes(fileName)) {
      throw new BadRequestException('Cannot delete critical server files');
    }

    try {
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        await fs.remove(fullPath);
        this.logger.log(`Directory deleted: ${itemPath} for server ${serverId}`);
      } else {
        await fs.unlink(fullPath);
        this.logger.log(`File deleted: ${itemPath} for server ${serverId}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException('File or directory not found');
      }
      this.logger.error(`Failed to delete ${itemPath} for server ${serverId}`, error);
      throw new BadRequestException('Failed to delete item');
    }
  }

  /**
   * Rename/move file or directory
   */
  async renameItem(userId: string, serverId: string, oldPath: string, newPath: string): Promise<void> {
    const server = await this.validateServerAccess(userId, serverId);
    
    if (!server.serverPath) {
      throw new BadRequestException('Server path not configured');
    }

    const oldFullPath = this.buildSafePath(server.serverPath, oldPath);
    const newFullPath = this.buildSafePath(server.serverPath, newPath);
    
    try {
      // Ensure target directory exists
      await fs.ensureDir(path.dirname(newFullPath));
      
      // Move/rename the item
      await fs.move(oldFullPath, newFullPath);
      
      this.logger.log(`Item renamed: ${oldPath} -> ${newPath} for server ${serverId}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException('Source file or directory not found');
      }
      this.logger.error(`Failed to rename ${oldPath} to ${newPath} for server ${serverId}`, error);
      throw new BadRequestException('Failed to rename item');
    }
  }

  /**
   * Upload file (placeholder for multipart upload handling)
   */
  async uploadFile(userId: string, serverId: string, targetPath: string, fileBuffer: Buffer, fileName: string): Promise<void> {
    const server = await this.validateServerAccess(userId, serverId);
    
    if (!server.serverPath) {
      throw new BadRequestException('Server path not configured');
    }

    const fullPath = this.buildSafePath(server.serverPath, path.join(targetPath, fileName));
    
    try {
      // Ensure directory exists
      await fs.ensureDir(path.dirname(fullPath));
      
      // Write file
      await fs.writeFile(fullPath, fileBuffer);
      
      this.logger.log(`File uploaded: ${fileName} to ${targetPath} for server ${serverId}`);
    } catch (error) {
      this.logger.error(`Failed to upload file ${fileName} for server ${serverId}`, error);
      throw new BadRequestException('Failed to upload file');
    }
  }

  /**
   * Get file/directory info
   */
  async getItemInfo(userId: string, serverId: string, itemPath: string): Promise<FileInfo> {
    const server = await this.validateServerAccess(userId, serverId);
    
    if (!server.serverPath) {
      throw new BadRequestException('Server path not configured');
    }

    const fullPath = this.buildSafePath(server.serverPath, itemPath);
    
    try {
      const stats = await fs.stat(fullPath);
      
      return {
        name: path.basename(itemPath),
        path: itemPath,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime,
        permissions: this.getPermissions(stats.mode),
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException('File or directory not found');
      }
      this.logger.error(`Failed to get info for ${itemPath} for server ${serverId}`, error);
      throw new BadRequestException('Failed to get item info');
    }
  }

  /**
   * Search files by name
   */
  async searchFiles(userId: string, serverId: string, query: string, searchPath = '/'): Promise<FileInfo[]> {
    const server = await this.validateServerAccess(userId, serverId);
    
    if (!server.serverPath) {
      throw new BadRequestException('Server path not configured');
    }

    const fullPath = this.buildSafePath(server.serverPath, searchPath);
    const results: FileInfo[] = [];
    
    try {
      await this.searchRecursive(fullPath, query.toLowerCase(), results, searchPath);
      return results.slice(0, 100); // Limit results
    } catch (error) {
      this.logger.error(`Failed to search files for server ${serverId}`, error);
      throw new BadRequestException('Failed to search files');
    }
  }

  /**
   * Validate server access
   */
  private async validateServerAccess(userId: string, serverId: string) {
    const server = await this.prisma.gameServer.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    if (server.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return server;
  }

  /**
   * Build safe file path (prevent directory traversal)
   */
  private buildSafePath(basePath: string, relativePath: string): string {
    const normalizedPath = path.normalize(relativePath).replace(/^(\\..[/\\\\])+/, '');
    const fullPath = path.join(basePath, normalizedPath);
    
    // Ensure the path is within the base directory
    if (!fullPath.startsWith(path.resolve(basePath))) {
      throw new BadRequestException('Invalid file path');
    }
    
    return fullPath;
  }

  /**
   * Get file permissions string
   */
  private getPermissions(mode: number): string {
    const perms = (mode & parseInt('777', 8)).toString(8);
    return perms.padStart(3, '0');
  }

  /**
   * Recursive file search
   */
  private async searchRecursive(dir: string, query: string, results: FileInfo[], basePath: string): Promise<void> {
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        const relativePath = path.relative(basePath, itemPath).replace(/\\\\/g, '/');
        
        if (item.name.toLowerCase().includes(query)) {
          const stats = await fs.stat(itemPath);
          results.push({
            name: item.name,
            path: relativePath,
            isDirectory: item.isDirectory(),
            size: stats.size,
            modified: stats.mtime,
            permissions: this.getPermissions(stats.mode),
          });
        }
        
        if (item.isDirectory() && results.length < 100) {
          await this.searchRecursive(itemPath, query, results, basePath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }
}