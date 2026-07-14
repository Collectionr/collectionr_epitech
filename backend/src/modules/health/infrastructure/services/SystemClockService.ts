import { Injectable } from '@nestjs/common';
import { IClockService } from '../../application/ports/IClockService';

@Injectable()
export class SystemClockService implements IClockService {
  now(): Date {
    return new Date();
  }
}
