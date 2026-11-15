import type { OcrCardResult } from '../entities/OcrMessages';
import { classifyOcrResult } from './ClassifyOcrResult';
import { OCR_CONFIDENCE_HIGH, OCR_CONFIDENCE_LOW } from './OcrPolicy';

function result(changes: Partial<OcrCardResult>): OcrCardResult {
  return {
    name: 'Funécire',
    setCode: 'TWM FR',
    setNumber: '036/167',
    language: 'fr',
    rarity: 'Common',
    confidence: 0.94,
    modelVersion: 'test',
    processingMs: 1000,
    ...changes,
  };
}

describe('classifyOcrResult', () => {
  it('rates a confident result with a name and a number as high', () => {
    expect(classifyOcrResult(result({}))).toBe('high');
  });

  it('rates a result exactly at the high threshold as high', () => {
    expect(classifyOcrResult(result({ confidence: OCR_CONFIDENCE_HIGH }))).toBe('high');
  });

  it('rates a result just under the high threshold as low', () => {
    expect(classifyOcrResult(result({ confidence: OCR_CONFIDENCE_HIGH - 0.01 }))).toBe('low');
  });

  it('rates a result exactly at the low threshold as low, not unidentified', () => {
    expect(classifyOcrResult(result({ confidence: OCR_CONFIDENCE_LOW }))).toBe('low');
  });

  it('rates a result under the low threshold as unidentified', () => {
    expect(classifyOcrResult(result({ confidence: OCR_CONFIDENCE_LOW - 0.01 }))).toBe(
      'unidentified',
    );
  });

  it.each([
    ['no number', { setNumber: null }],
    ['no name', { name: null }],
  ])('never rates a result with %s as high, whatever its score', (_label, changes) => {
    expect(classifyOcrResult(result({ ...changes, confidence: 1 }))).toBe('low');
  });

  it('rates a result where neither name nor number was read as unidentified, even when confident', () => {
    expect(classifyOcrResult(result({ name: null, setNumber: null, confidence: 1 }))).toBe(
      'unidentified',
    );
  });

  it.each([
    ['set code', { setCode: null }],
    ['language', { language: null }],
    ['rarity', { rarity: null }],
  ])('does not need the %s to rate a result high', (_label, changes) => {
    expect(classifyOcrResult(result(changes))).toBe('high');
  });
});
