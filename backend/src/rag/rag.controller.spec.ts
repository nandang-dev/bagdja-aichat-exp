import { Test, TestingModule } from '@nestjs/testing';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

describe('RagController', () => {
  let controller: RagController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagController],
      providers: [
        {
          provide: RagService,
          useValue: {
            buildIndex: jest.fn(),
            chat: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RagController>(RagController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /rag/test handler returns expected payload', () => {
    expect(controller.test()).toEqual({ message: 'RAG module working' });
  });
});

