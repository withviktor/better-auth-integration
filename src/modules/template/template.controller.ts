import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TemplateService, CreateTemplateDto, UpdateTemplateDto } from './template.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('templates')
export class TemplateController {
  constructor(private templateService: TemplateService) {}

  /**
   * Get all available templates
   */
  @Get()
  async getTemplates(@Request() req: any) {
    const userId = req.user?.id; // Optional authentication
    return this.templateService.getTemplates(userId);
  }

  /**
   * Get templates by game type
   */
  @Get('game-type/:gameType')
  async getTemplatesByGameType(
    @Param('gameType') gameType: string,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    return this.templateService.getTemplatesByGameType(gameType, userId);
  }

  /**
   * Get supported game types
   */
  @Get('game-types')
  getGameTypes() {
    return this.templateService.getGameTypes();
  }

  /**
   * Get specific template
   */
  @Get(':id')
  async getTemplate(@Param('id') templateId: string, @Request() req: any) {
    const userId = req.user?.id;
    return this.templateService.getTemplate(templateId, userId);
  }

  /**
   * Create new template (requires authentication)
   */
  @Post()
  @UseGuards(AuthGuard)
  async createTemplate(@Request() req: any, @Body() createDto: CreateTemplateDto) {
    return this.templateService.createTemplate(req.user.id, createDto);
  }

  /**
   * Update template (requires authentication and ownership)
   */
  @Put(':id')
  @UseGuards(AuthGuard)
  async updateTemplate(
    @Request() req: any,
    @Param('id') templateId: string,
    @Body() updateDto: UpdateTemplateDto,
  ) {
    return this.templateService.updateTemplate(templateId, req.user.id, updateDto);
  }

  /**
   * Delete template (requires authentication and ownership)
   */
  @Delete(':id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(@Request() req: any, @Param('id') templateId: string) {
    await this.templateService.deleteTemplate(templateId, req.user.id);
  }

  /**
   * Clone template (requires authentication)
   */
  @Post(':id/clone')
  @UseGuards(AuthGuard)
  async cloneTemplate(
    @Request() req: any,
    @Param('id') templateId: string,
    @Body() body: { name?: string },
  ) {
    return this.templateService.cloneTemplate(templateId, req.user.id, body.name);
  }
}