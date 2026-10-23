// Messages are fixed on purpose: an error message ends up in an HTTP response and in logs, and
// must never echo what the caller sent (an email, an id) nor confirm more than the status code does.
export class EmailAlreadyUsedError extends Error {
  constructor() {
    super('Email is already registered');
    this.name = 'EmailAlreadyUsedError';
  }
}

export class UsernameAlreadyUsedError extends Error {
  constructor() {
    super('Username is already taken');
    this.name = 'UsernameAlreadyUsedError';
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
  constructor() {
    super('User not found');
    this.name = 'UserNotFoundError';
  }
}

export class IncorrectCurrentPasswordError extends Error {
  constructor() {
    super('Current password is incorrect');
    this.name = 'IncorrectCurrentPasswordError';
  }
}

export class SamePasswordError extends Error {
  constructor() {
    super('The new password must differ from the current one');
    this.name = 'SamePasswordError';
  }
}

export class ConsentRequiredError extends Error {
  constructor() {
    super('Registration requires accepting the terms of service');
    this.name = 'ConsentRequiredError';
  }
}

/** The user accepted a version of the terms that is no longer the current one (or an unknown one). */
export class TermsVersionMismatchError extends Error {
  constructor() {
    super('The terms of service have changed; review the current version before accepting');
    this.name = 'TermsVersionMismatchError';
  }
}
