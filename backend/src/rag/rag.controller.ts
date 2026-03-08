import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RagService } from './rag.service';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Get('test')
  test() {
    return {
      message: 'RAG module working',
    };
  }

  @Get('documents')
  listDocuments(@Query('appId') appId: string) {
    if (!appId) {
      throw new BadRequestException('appId wajib diisi');
    }

    return this.ragService.listDocuments(appId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    //@ts-ignore
    @UploadedFile() file: Express.Multer.File,
    @Body('appId') appId: string,
  ) {
    if (!appId) {
      throw new BadRequestException('appId wajib diisi');
    }

    if (!file) {
      throw new BadRequestException('file wajib diisi');
    }

    return this.ragService.saveDocument(appId, file.originalname, file.buffer);
  }

  @Put('documents/:filename/replace')
  @UseInterceptors(FileInterceptor('file'))
  replaceDocument(
    @Param('filename') filename: string,
    //@ts-ignore
    @UploadedFile() file: Express.Multer.File,
    @Body('appId') appId: string,
  ) {
    if (!appId) {
      throw new BadRequestException('appId wajib diisi');
    }

    if (!file) {
      throw new BadRequestException('file wajib diisi');
    }

    return this.ragService.replaceDocument(appId, filename, file.buffer);
  }

  @Delete('documents/:filename')
  deleteDocument(
    @Param('filename') filename: string,
    @Query('appId') appId: string,
  ) {
    if (!appId) {
      throw new BadRequestException('appId wajib diisi');
    }

    return this.ragService.deleteDocument(appId, filename);
  }

  @Post('reindex')
  reindex(@Body('appId') appId: string) {
    if (!appId) {
      throw new BadRequestException('appId wajib diisi');
    }

    return this.ragService.buildIndex(appId);
  }

  @Post('chat')
  chat(@Body('appId') appId: string, @Body('question') question: string) {
    if (!appId) {
      throw new BadRequestException('appId wajib diisi');
    }

    return this.ragService.chat(appId, question);
  }
}