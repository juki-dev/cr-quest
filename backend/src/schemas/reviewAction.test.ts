import { describe, expect, it } from 'vitest';
import { reviewActionSchema, reviewQuerySchema } from './reviewAction.js';

describe('reviewActionSchema', () => {
  it('acepta publicar sin narrativa editada', () => {
    expect(reviewActionSchema.safeParse({ action: 'publicar' }).success).toBe(true);
  });

  it('acepta publicar con narrativa editada', () => {
    expect(
      reviewActionSchema.safeParse({ action: 'publicar', narrative: 'texto corregido' }).success,
    ).toBe(true);
  });

  it('acepta rechazar', () => {
    expect(reviewActionSchema.safeParse({ action: 'rechazar' }).success).toBe(true);
  });

  it('rechaza una acción fuera del enum', () => {
    expect(reviewActionSchema.safeParse({ action: 'aprobar' }).success).toBe(false);
  });

  it('rechaza correctSequence en el body (BE-API.8)', () => {
    expect(
      reviewActionSchema.safeParse({ action: 'publicar', correctSequence: ['s1'] }).success,
    ).toBe(false);
  });
});

describe('reviewQuerySchema', () => {
  it('por defecto filtra por borrador', () => {
    const result = reviewQuerySchema.parse({});
    expect(result.status).toBe('borrador');
  });

  it('acepta los demás estados válidos', () => {
    expect(reviewQuerySchema.safeParse({ status: 'publicado' }).success).toBe(true);
  });

  it('rechaza un estado inexistente', () => {
    expect(reviewQuerySchema.safeParse({ status: 'en_revision' }).success).toBe(false);
  });
});
