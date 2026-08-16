/**
 * Simple error handling utilities.
 */
export class LocalizedError extends Error {
  constructor(public readonly messageKey: string) {
    super(messageKey);
    this.name = "LocalizedError";
  }
}

export function createLocalizedError(key: string): LocalizedError {
  return new LocalizedError(key);
}
