export class EmailAlreadyUsedError extends Error {
  constructor(email: string) {
    super(`Email "${email}" is already registered`);
    this.name = 'EmailAlreadyUsedError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('Invalid, expired or revoked refresh token');
    this.name = 'InvalidRefreshTokenError';
  }
}

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User "${userId}" not found`);
    this.name = 'UserNotFoundError';
  }
}

export class IncorrectCurrentPasswordError extends Error {
  constructor() {
    super('Current password is incorrect');
    this.name = 'IncorrectCurrentPasswordError';
  }
}

export class ConsentRequiredError extends Error {
  constructor() {
    super('Registration requires accepting the terms of service');
    this.name = 'ConsentRequiredError';
  }
}
