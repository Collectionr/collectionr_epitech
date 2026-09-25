import { BadRequestException } from '@nestjs/common';
import { IsString } from 'class-validator';
import { createValidationPipe } from './CreateValidationPipe';

class SampleDto {
  @IsString()
  name!: string;
}

describe('createValidationPipe', () => {
  const metadata = { type: 'body' as const, metatype: SampleDto, data: undefined };

  it('transforms a valid payload into a DTO instance', async () => {
    const pipe = createValidationPipe();

    const result: unknown = await pipe.transform({ name: 'Pikachu' }, metadata);

    expect(result).toBeInstanceOf(SampleDto);
  });

  it('rejects undeclared properties', async () => {
    const pipe = createValidationPipe();

    await expect(pipe.transform({ name: 'Pikachu', isAdmin: true }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an invalid payload', async () => {
    const pipe = createValidationPipe();

    await expect(pipe.transform({ name: 42 }, metadata)).rejects.toThrow(BadRequestException);
  });
});
