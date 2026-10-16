import { describe, expect, it } from '@jest/globals';

import { APP_NAME } from '@shared/constants';

import appConfig from './app.json';

describe('app.json', () => {
  it("déclare le même nom d'application que APP_NAME", () => {
    expect(appConfig.expo.name).toBe(APP_NAME);
  });
});
