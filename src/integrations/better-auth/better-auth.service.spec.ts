import { Test, TestingModule } from '@nestjs/testing';
import { BetterAuthService } from './better-auth.service';

describe('BetterAuthService', () => {
  let service: BetterAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BetterAuthService],
    }).compile();

    service = module.get<BetterAuthService>(BetterAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
