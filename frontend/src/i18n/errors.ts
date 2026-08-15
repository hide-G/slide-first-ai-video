import {
  message,
  type MessageArguments,
  type MessageDescriptor,
  type MessageKey,
} from "./messages.js";

export class LocalizedError extends Error {
  constructor(public readonly descriptor: MessageDescriptor) {
    super(descriptor.key);
    this.name = "LocalizedError";
  }
}

export function createLocalizedError<Key extends MessageKey>(
  key: Key,
  ...args: MessageArguments<Key>
): LocalizedError {
  return new LocalizedError(message(key, ...args));
}

export function getErrorDescriptor(
  error: unknown,
  fallback: MessageDescriptor,
): MessageDescriptor {
  return error instanceof LocalizedError ? error.descriptor : fallback;
}
