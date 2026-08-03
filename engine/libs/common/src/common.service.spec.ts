import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CommonService, seatLockKey } from './common.service';

describe('CommonService', () => {
  let service: CommonService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommonService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) =>
              key === 'REDIS_PORT' ? '6379' : 'localhost',
          },
        },
      ],
    }).compile();

    service = module.get<CommonService>(CommonService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('seatLockKey format stabil antar app', () => {
    expect(seatLockKey('A-1')).toBe('lock:seat:A-1');
  });

  it('releaseLock memakai eval Lua (compare-and-delete), bukan DEL polos', async () => {
    const evalMock = jest.fn().mockResolvedValue(1);
    const withClient = service as unknown as {
      redisClient: { eval: jest.Mock };
    };
    withClient.redisClient = { eval: evalMock };
    await service.releaseLock('lock:seat:A-1', 'user-1');
    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining('redis.call'),
      1,
      'lock:seat:A-1',
      'user-1',
    );
  });
});
