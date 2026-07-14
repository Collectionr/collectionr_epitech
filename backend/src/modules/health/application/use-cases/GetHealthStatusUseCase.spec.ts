import { GetHealthStatusUseCase } from './GetHealthStatusUseCase';
import { IClockService } from '../ports/IClockService';

describe('GetHealthStatusUseCase', () => {
  it('returns an ok status using the injected clock', () => {
    const fixedDate = new Date('2026-01-01T00:00:00.000Z');
    const nowSpy = jest.fn().mockReturnValue(fixedDate);
    const mockClockService: IClockService = { now: nowSpy };

    const useCase = new GetHealthStatusUseCase(mockClockService);
    const result = useCase.execute();

    expect(result.state).toBe('ok');
    expect(result.checkedAt).toBe(fixedDate);
    expect(nowSpy).toHaveBeenCalledTimes(1);
  });
});
