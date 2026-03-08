import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('GET / serves index.html', () => {
    const res = { sendFile: jest.fn() } as any;
    appController.root(res);
    expect(res.sendFile).toHaveBeenCalledWith(
      expect.stringMatching(/public\/index\.html$/),
    );
  });

  it('GET /api/hello returns Hello World!', () => {
    expect(appController.getHello()).toBe('Hello World!');
  });
});
