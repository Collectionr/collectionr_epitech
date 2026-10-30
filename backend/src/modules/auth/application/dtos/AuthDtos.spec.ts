import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePasswordDto } from './ChangePasswordDto';
import { LoginDto } from './LoginDto';
import { RefreshTokenDto } from './RefreshTokenDto';
import { RegisterDto } from './RegisterDto';
import { UpdateProfileDto } from './UpdateProfileDto';

type Constructor<T> = new () => T;

async function propertiesInError<T extends object>(
  type: Constructor<T>,
  payload: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(type, payload));
  return errors.map((error) => error.property);
}

const validRegistration = {
  email: 'ash@example.com',
  password: 'Str0ngPassw0rd!',
  username: 'ash_ketchum',
  acceptedTermsVersion: '1',
};

describe('RegisterDto', () => {
  it('accepts a valid registration', async () => {
    await expect(propertiesInError(RegisterDto, validRegistration)).resolves.toEqual([]);
  });

  it('refuses an oversized email (900 000 characters used to be stored in the audit trail)', async () => {
    const email = `${'a'.repeat(900_000)}@example.com`;

    await expect(
      propertiesInError(RegisterDto, { ...validRegistration, email }),
    ).resolves.toContain('email');
  });

  it('refuses an email over 254 characters', async () => {
    const email = `${'a'.repeat(250)}@example.com`;

    await expect(
      propertiesInError(RegisterDto, { ...validRegistration, email }),
    ).resolves.toContain('email');
  });

  it('refuses an oversized password before it reaches bcrypt', async () => {
    await expect(
      propertiesInError(RegisterDto, { ...validRegistration, password: 'a1'.repeat(1000) }),
    ).resolves.toContain('password');
  });

  it('refuses an oversized username', async () => {
    await expect(
      propertiesInError(RegisterDto, { ...validRegistration, username: 'u'.repeat(65) }),
    ).resolves.toContain('username');
  });
});

describe('RegisterDto terms acceptance', () => {
  it('accepts a well-formed terms version', async () => {
    await expect(
      propertiesInError(RegisterDto, {
        ...validRegistration,
        acceptedTermsVersion: '2026-01.fr_B',
      }),
    ).resolves.toEqual([]);
  });

  it('accepts an absent version: the use case answers ConsentRequiredError, a 400 too', async () => {
    const withoutAcceptance: Record<string, unknown> = { ...validRegistration };
    delete withoutAcceptance.acceptedTermsVersion;

    await expect(propertiesInError(RegisterDto, withoutAcceptance)).resolves.toEqual([]);
  });

  it.each(['', ' ', 'v 1', 'v1;drop', 'é', 'x'.repeat(33)])(
    'refuses the malformed version %j',
    async (acceptedTermsVersion) => {
      await expect(
        propertiesInError(RegisterDto, { ...validRegistration, acceptedTermsVersion }),
      ).resolves.toContain('acceptedTermsVersion');
    },
  );
});

describe('LoginDto', () => {
  it('accepts a malformed email: the use case answers it exactly like a wrong password', async () => {
    await expect(
      propertiesInError(LoginDto, { email: 'not-an-email', password: 'whatever' }),
    ).resolves.toEqual([]);
  });

  it('refuses an oversized email or password', async () => {
    await expect(
      propertiesInError(LoginDto, { email: 'a'.repeat(400), password: 'x'.repeat(200) }),
    ).resolves.toEqual(expect.arrayContaining(['email', 'password']));
  });
});

describe('RefreshTokenDto', () => {
  it('accepts a token-sized value and refuses an oversized one', async () => {
    await expect(propertiesInError(RefreshTokenDto, { refreshToken: 'a.b.c' })).resolves.toEqual(
      [],
    );
    await expect(
      propertiesInError(RefreshTokenDto, { refreshToken: 'a'.repeat(5000) }),
    ).resolves.toContain('refreshToken');
  });
});

describe('ChangePasswordDto', () => {
  it('refuses an oversized current or new password', async () => {
    await expect(
      propertiesInError(ChangePasswordDto, {
        currentPassword: 'x'.repeat(200),
        newPassword: 'y1'.repeat(100),
      }),
    ).resolves.toEqual(expect.arrayContaining(['currentPassword', 'newPassword']));
  });
});

describe('UpdateProfileDto', () => {
  it('accepts a username and refuses an empty or oversized one', async () => {
    await expect(propertiesInError(UpdateProfileDto, { username: 'new_name' })).resolves.toEqual(
      [],
    );
    await expect(propertiesInError(UpdateProfileDto, { username: '' })).resolves.toContain(
      'username',
    );
    await expect(
      propertiesInError(UpdateProfileDto, { username: 'u'.repeat(65) }),
    ).resolves.toContain('username');
  });
});
