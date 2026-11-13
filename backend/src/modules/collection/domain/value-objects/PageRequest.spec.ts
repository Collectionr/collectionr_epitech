import { PageRequest } from './PageRequest';
import { DomainValidationError } from '../errors/DomainValidationError';

describe('PageRequest', () => {
  it('defaults to the first page with the default page size', () => {
    const request = PageRequest.create();

    expect(request.page).toBe(1);
    expect(request.pageSize).toBe(50);
    expect(request.offset).toBe(0);
  });

  it('keeps the given values and computes the offset', () => {
    const request = PageRequest.create({ page: 3, pageSize: 20 });

    expect(request.page).toBe(3);
    expect(request.pageSize).toBe(20);
    expect(request.offset).toBe(40);
  });

  it('accepts the page size limit and the last page', () => {
    expect(PageRequest.create({ pageSize: 100 }).pageSize).toBe(100);
    expect(PageRequest.create({ page: 100_000 }).offset).toBe(99_999 * 50);
  });

  it.each([0, -1, 1.5, Number.NaN, 100_001])('rejects the page %s', (page) => {
    expect(() => PageRequest.create({ page })).toThrow(DomainValidationError);
    expect(() => PageRequest.create({ page })).toThrow(/Page must be/);
  });

  it.each([0, -1, 1.5, Number.NaN, 101])('rejects the page size %s', (pageSize) => {
    expect(() => PageRequest.create({ pageSize })).toThrow(DomainValidationError);
    expect(() => PageRequest.create({ pageSize })).toThrow(/Page size must be/);
  });
});
