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
import { FileManagerService, EditFileDto } from './file-manager.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('files')
@UseGuards(AuthGuard)
export class FileManagerController {
  constructor(private fileManagerService: FileManagerService) {}

  /**
   * List files in server directory
   */
  @Get('servers/:serverId')
  async listFiles(
    @Request() req: any,
    @Param('serverId') serverId: string,
    @Query('path') path?: string,
  ) {
    return this.fileManagerService.listFiles(req.user.id, serverId, path);
  }

  /**
   * Get file content
   */
  @Get('servers/:serverId/content')
  async readFile(
    @Request() req: any,
    @Param('serverId') serverId: string,
    @Query('path') filePath: string,
  ) {
    const content = await this.fileManagerService.readFile(req.user.id, serverId, filePath);
    return { content };
  }

  /**
   * Update file content
   */
  @Put('servers/:serverId/content')
  async writeFile(
    @Request() req: any,
    @Param('serverId') serverId: string,
    @Query('path') filePath: string,
    @Body() editDto: EditFileDto,
  ) {
    await this.fileManagerService.writeFile(req.user.id, serverId, filePath, editDto);
    return { message: 'File updated successfully' };
  }

  /**
   * Create directory
   */
  @Post('servers/:serverId/directories')
  async createDirectory(
    @Request() req: any,
    @Param('serverId') serverId: string,
    @Body() body: { path: string },
  ) {
    await this.fileManagerService.createDirectory(req.user.id, serverId, body.path);
    return { message: 'Directory created successfully' };
  }

  /**
   * Delete file or directory
   */
  @Delete('servers/:serverId/items')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteItem(
    @Request() req: any,
    @Param('serverId') serverId: string,
    @Query('path') itemPath: string,
  ) {
    await this.fileManagerService.deleteItem(req.user.id, serverId, itemPath);
  }

  /**
   * Rename/move file or directory
   */
  @Put('servers/:serverId/items/rename')
  async renameItem(
    @Request() req: any,
    @Param('serverId') serverId: string,
    @Body() body: { oldPath: string; newPath: string },
  ) {
    await this.fileManagerService.renameItem(req.user.id, serverId, body.oldPath, body.newPath);
    return { message: 'Item renamed successfully' };
  }

  /**
   * Get file/directory info
   */
  @Get('servers/:serverId/info')
  async getItemInfo(
    @Request() req: any,
    @Param('serverId') serverId: string,
    @Query('path') itemPath: string,
  ) {
    return this.fileManagerService.getItemInfo(req.user.id, serverId, itemPath);
  }

  /**
   * Search files
   */
  @Get('servers/:serverId/search')
  async searchFiles(
    @Request() req: any,
    @Param('serverId') serverId: string,
    @Query('q') query: string,
    @Query('path') searchPath?: string,
  ) {
    return this.fileManagerService.searchFiles(req.user.id, serverId, query, searchPath);
  }
}