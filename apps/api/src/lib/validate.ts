import type { z } from 'zod';
import { AppError } from '../errors';

function parseInput<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const flattened = result.error.flatten();
    const fields: Record<string, string[]> = {};

    for (const [key, messages] of Object.entries(flattened.fieldErrors)) {
      if (messages) fields[key] = messages;
    }

    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input.', fields);
  }
  return result.data;
}

export function parseBody<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return parseInput(schema, data);
}

export function parseQuery<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return parseInput(schema, data);
}
