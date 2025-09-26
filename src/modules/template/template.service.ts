import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServerTemplate } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface CreateTemplateDto {
  name: string;
  description?: string;
  gameType: string;
  version: string;
  dockerImage: string;
  dockerfile?: string;
  defaultConfig?: any;
  environment?: any;
  minMemory?: number;
  maxMemory?: number;
  minCpu?: number;
  maxCpu?: number;
  isPublic?: boolean;
}

export interface UpdateTemplateDto {
  name?: string;
  description?: string;
  version?: string;
  dockerImage?: string;
  dockerfile?: string;
  defaultConfig?: any;
  environment?: any;
  minMemory?: number;
  maxMemory?: number;
  minCpu?: number;
  maxCpu?: number;
  isPublic?: boolean;
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Create default templates on startup
    await this.createDefaultTemplates();
  }

  /**
   * Create a new template
   */
  async createTemplate(userId: string, createDto: CreateTemplateDto): Promise<ServerTemplate> {
    const template = await this.prisma.serverTemplate.create({
      data: {
        id: uuidv4(),
        ...createDto,
        userId,
      },
    });

    this.logger.log(`Template created: ${template.name} (${template.id})`);
    return template;
  }

  /**
   * Get all public templates and user's private templates
   */
  async getTemplates(userId?: string): Promise<ServerTemplate[]> {
    const where: any = {
      OR: [
        { isPublic: true },
      ],
    };

    if (userId) {
      where.OR.push({ userId });
    }

    return this.prisma.serverTemplate.findMany({
      where,
      orderBy: [
        { isPublic: 'desc' }, // Public templates first
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Get templates by game type
   */
  async getTemplatesByGameType(gameType: string, userId?: string): Promise<ServerTemplate[]> {
    const where: any = {
      gameType,
      OR: [
        { isPublic: true },
      ],
    };

    if (userId) {
      where.OR.push({ userId });
    }

    return this.prisma.serverTemplate.findMany({
      where,
      orderBy: [
        { isPublic: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string, userId?: string): Promise<ServerTemplate> {
    const template = await this.prisma.serverTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Check access permissions
    if (!template.isPublic && template.userId !== userId) {
      throw new ForbiddenException('Access denied to this template');
    }

    return template;
  }

  /**
   * Update template
   */
  async updateTemplate(templateId: string, userId: string, updateDto: UpdateTemplateDto): Promise<ServerTemplate> {
    const template = await this.prisma.serverTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.userId !== userId) {
      throw new ForbiddenException('You can only update your own templates');
    }

    const updatedTemplate = await this.prisma.serverTemplate.update({
      where: { id: templateId },
      data: updateDto,
    });

    this.logger.log(`Template updated: ${updatedTemplate.name} (${templateId})`);
    return updatedTemplate;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    const template = await this.prisma.serverTemplate.findUnique({
      where: { id: templateId },
      include: { gameServers: true },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.userId !== userId) {
      throw new ForbiddenException('You can only delete your own templates');
    }

    if (template.gameServers.length > 0) {
      throw new ForbiddenException('Cannot delete template that is being used by servers');
    }

    await this.prisma.serverTemplate.delete({
      where: { id: templateId },
    });

    this.logger.log(`Template deleted: ${template.name} (${templateId})`);
  }

  /**
   * Clone a public template
   */
  async cloneTemplate(templateId: string, userId: string, name?: string): Promise<ServerTemplate> {
    const originalTemplate = await this.getTemplate(templateId, userId);

    const clonedTemplate = await this.prisma.serverTemplate.create({
      data: {
        id: uuidv4(),
        name: name || `${originalTemplate.name} (Copy)`,
        description: originalTemplate.description,
        gameType: originalTemplate.gameType,
        version: originalTemplate.version,
        dockerImage: originalTemplate.dockerImage,
        dockerfile: originalTemplate.dockerfile,
        defaultConfig: originalTemplate.defaultConfig,
        environment: originalTemplate.environment,
        minMemory: originalTemplate.minMemory,
        maxMemory: originalTemplate.maxMemory,
        minCpu: originalTemplate.minCpu,
        maxCpu: originalTemplate.maxCpu,
        isPublic: false, // Cloned templates are private by default
        userId,
      },
    });

    this.logger.log(`Template cloned: ${clonedTemplate.name} (${clonedTemplate.id})`);
    return clonedTemplate;
  }

  /**
   * Get supported game types
   */
  getGameTypes(): any[] {
    return [
      {
        id: 'minecraft',
        name: 'Minecraft Java Edition',
        description: 'The classic Minecraft server for Java Edition',
        defaultPort: 25565,
        supportedVersions: ['1.20.4', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.17.1', '1.16.5'],
      },
      {
        id: 'minecraft-bedrock',
        name: 'Minecraft Bedrock Edition',
        description: 'Minecraft server for Bedrock Edition (Mobile, Console, Windows 10)',
        defaultPort: 19132,
        supportedVersions: ['1.20.40', '1.20.30', '1.20.10', '1.19.80', '1.19.70'],
      },
      {
        id: 'valheim',
        name: 'Valheim',
        description: 'Valheim dedicated server',
        defaultPort: 2456,
        supportedVersions: ['latest', '0.217.46', '0.217.14'],
      },
      {
        id: 'terraria',
        name: 'Terraria',
        description: 'Terraria dedicated server',
        defaultPort: 7777,
        supportedVersions: ['1.4.4.9', '1.4.4.8', '1.4.3.6'],
      },
      {
        id: 'csgo',
        name: 'Counter-Strike: Global Offensive',
        description: 'CS:GO dedicated server',
        defaultPort: 27015,
        supportedVersions: ['latest'],
      },
      {
        id: 'gmod',
        name: "Garry's Mod",
        description: "Garry's Mod dedicated server",
        defaultPort: 27015,
        supportedVersions: ['latest'],
      },
    ];
  }

  /**
   * Create default templates (called on startup)
   */
  private async createDefaultTemplates(): Promise<void> {
    try {
      // Check if default templates already exist
      const existingTemplates = await this.prisma.serverTemplate.count({
        where: { userId: null, isPublic: true },
      });

      if (existingTemplates > 0) {
        this.logger.log('Default templates already exist, skipping creation');
        return;
      }

      const defaultTemplates: CreateTemplateDto[] = [
        // Minecraft Java Edition Templates
        {
          name: 'Minecraft 1.20.4 Vanilla',
          description: 'Latest Minecraft Java Edition vanilla server',
          gameType: 'minecraft',
          version: '1.20.4',
          dockerImage: 'itzg/minecraft-server:java17',
          defaultConfig: {
            difficulty: 'normal',
            gamemode: 'survival',
            maxPlayers: 20,
            pvp: true,
            spawnProtection: 16,
            viewDistance: 10,
          },
          environment: {
            EULA: 'TRUE',
            VERSION: '1.20.4',
            TYPE: 'VANILLA',
            MEMORY: '2G',
          },
          minMemory: 1024,
          maxMemory: 4096,
          minCpu: 1,
          maxCpu: 4,
          isPublic: true,
        },
        {
          name: 'Minecraft 1.20.4 Paper',
          description: 'High-performance Minecraft server with Paper',
          gameType: 'minecraft',
          version: '1.20.4',
          dockerImage: 'itzg/minecraft-server:java17',
          defaultConfig: {
            difficulty: 'normal',
            gamemode: 'survival',
            maxPlayers: 50,
            pvp: true,
            spawnProtection: 16,
            viewDistance: 10,
          },
          environment: {
            EULA: 'TRUE',
            VERSION: '1.20.4',
            TYPE: 'PAPER',
            MEMORY: '4G',
            USE_AIKAR_FLAGS: 'true',
          },
          minMemory: 2048,
          maxMemory: 8192,
          minCpu: 2,
          maxCpu: 8,
          isPublic: true,
        },
        {
          name: 'Minecraft 1.20.4 Forge',
          description: 'Minecraft server with Forge mod support',
          gameType: 'minecraft',
          version: '1.20.4',
          dockerImage: 'itzg/minecraft-server:java17',
          defaultConfig: {
            difficulty: 'normal',
            gamemode: 'survival',
            maxPlayers: 20,
            pvp: true,
            spawnProtection: 16,
            viewDistance: 10,
          },
          environment: {
            EULA: 'TRUE',
            VERSION: '1.20.4',
            TYPE: 'FORGE',
            MEMORY: '4G',
          },
          minMemory: 3072,
          maxMemory: 8192,
          minCpu: 2,
          maxCpu: 8,
          isPublic: true,
        },
        // Minecraft Bedrock Template
        {
          name: 'Minecraft Bedrock Latest',
          description: 'Minecraft Bedrock Edition server',
          gameType: 'minecraft-bedrock',
          version: 'latest',
          dockerImage: 'itzg/minecraft-bedrock-server',
          defaultConfig: {
            difficulty: 'normal',
            gamemode: 'survival',
            maxPlayers: 10,
            allowCheats: false,
          },
          environment: {
            EULA: 'TRUE',
            GAMEMODE: 'survival',
            DIFFICULTY: 'normal',
          },
          minMemory: 1024,
          maxMemory: 4096,
          minCpu: 1,
          maxCpu: 4,
          isPublic: true,
        },
        // Valheim Template
        {
          name: 'Valheim Server',
          description: 'Valheim dedicated server',
          gameType: 'valheim',
          version: 'latest',
          dockerImage: 'lloesche/valheim-server',
          defaultConfig: {
            worldName: 'GoodHost World',
            password: 'changeme',
            public: false,
          },
          environment: {
            SERVER_NAME: 'GoodHost Valheim Server',
            WORLD_NAME: 'GoodHost World',
            SERVER_PASS: 'changeme',
            SERVER_PUBLIC: 'false',
          },
          minMemory: 2048,
          maxMemory: 8192,
          minCpu: 2,
          maxCpu: 8,
          isPublic: true,
        },
        // Terraria Template
        {
          name: 'Terraria Server',
          description: 'Terraria dedicated server',
          gameType: 'terraria',
          version: '1.4.4.9',
          dockerImage: 'ryshe/terraria:1.4.4.9',
          defaultConfig: {
            worldName: 'GoodHost World',
            maxPlayers: 8,
            password: '',
            difficulty: 1,
          },
          environment: {
            WORLD: 'GoodHost World',
            PASS: '',
            MAXPLAYERS: '8',
            SIZE: '2',
            DIFFICULTY: '1',
          },
          minMemory: 512,
          maxMemory: 2048,
          minCpu: 1,
          maxCpu: 4,
          isPublic: true,
        },
      ];

      for (const template of defaultTemplates) {
        await this.prisma.serverTemplate.create({
          data: {
            id: uuidv4(),
            ...template,
            userId: null, // System templates have no owner
          },
        });
      }

      this.logger.log(`Created ${defaultTemplates.length} default templates`);
    } catch (error) {
      this.logger.error('Failed to create default templates', error);
    }
  }
}