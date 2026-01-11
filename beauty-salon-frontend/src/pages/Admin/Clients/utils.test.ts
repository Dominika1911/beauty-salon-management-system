import { describe, it, expect } from 'vitest';
import {
  firstFromDrf,
  extractDrfMessage,
  normalizeClientValues,
  buildClientCreatePayload,
  buildClientUpdatePayload,
  BaseClientSchema,
  CreateClientSchema,
} from './utils';

/**
 * TESTY RZECZYWISTEJ LOGIKI BIZNESOWEJ - Clients
 */

describe('Clients Utils: firstFromDrf', () => {

  it('Zwraca string bezpośrednio', () => {
    expect(firstFromDrf('Error message')).toBe('Error message');
  });

  it('Zwraca pierwszy element z array', () => {
    expect(firstFromDrf(['First', 'Second'])).toBe('First');
  });

  it('Zwraca null dla pustych wartości', () => {
    expect(firstFromDrf(null)).toBeNull();
    expect(firstFromDrf(undefined)).toBeNull();
    expect(firstFromDrf([])).toBeNull();
  });
});

describe('Clients Utils: extractDrfMessage', () => {

  it('Wyciąga z pola detail', () => {
    expect(extractDrfMessage({ detail: 'Detail error' })).toBe('Detail error');
  });

  it('Wyciąga z non_field_errors', () => {
    expect(extractDrfMessage({ non_field_errors: ['Error 1'] })).toBe('Error 1');
  });

  it('Wyciąga pierwszą wartość z dowolnego pola', () => {
    expect(extractDrfMessage({ email: 'Invalid email' })).toBe('Invalid email');
    expect(extractDrfMessage({ password: ['Too short'] })).toBe('Too short');
  });
});

describe('Clients Utils: normalizeClientValues', () => {

  it('Trimuje wszystkie stringi', () => {
    const result = normalizeClientValues({
      first_name: '  Jan  ',
      last_name: '  Kowalski  ',
      phone: '  123456789  ',
      email: '  jan@test.com  ',
      internal_notes: '  Notatka  ',
      is_active: true,
      password: 'Pass123!',
    });

    expect(result.first_name).toBe('Jan');
    expect(result.last_name).toBe('Kowalski');
    expect(result.phone).toBe('123456789');
    expect(result.email).toBe('jan@test.com');
    expect(result.internal_notes).toBe('Notatka');
  });

  it('Zamienia pusty email na null', () => {
    const result = normalizeClientValues({
      first_name: 'Jan',
      last_name: 'Kowalski',
      phone: '',
      email: '   ',
      internal_notes: '',
      is_active: true,
      password: 'Pass123!',
    });

    expect(result.email).toBeNull();
  });

  it('Zamienia puste phone na undefined', () => {
    const result = normalizeClientValues({
      first_name: 'Jan',
      last_name: 'Kowalski',
      phone: '   ',
      email: 'jan@test.com',
      internal_notes: '',
      is_active: true,
      password: 'Pass123!',
    });

    expect(result.phone).toBeUndefined();
  });
});

describe('Clients Utils: buildClientCreatePayload', () => {

  it('Buduje kompletny payload dla nowego klienta', () => {
    const payload = buildClientCreatePayload({
      first_name: 'Jan',
      last_name: 'Kowalski',
      phone: '123456789',
      email: 'jan@test.com',
      internal_notes: 'VIP klient',
      is_active: true,
      password: 'SecurePass123!',
    });

    expect(payload.first_name).toBe('Jan');
    expect(payload.last_name).toBe('Kowalski');
    expect(payload.phone).toBe('123456789');
    expect(payload.email).toBe('jan@test.com');
    expect(payload.internal_notes).toBe('VIP klient');
    expect(payload.is_active).toBe(true);
    expect(payload.password).toBe('SecurePass123!');
  });
});

describe('Clients Utils: buildClientUpdatePayload', () => {

  it('Buduje payload bez hasła (edycja)', () => {
    const payload = buildClientUpdatePayload({
      first_name: 'Jan',
      last_name: 'Kowalski',
      phone: '987654321',
      email: 'new@test.com',
      internal_notes: 'Zmieniona notatka',
      is_active: false,
      password: 'ignored', // Nie powinno być w payload
    });

    expect(payload.first_name).toBe('Jan');
    expect('password' in payload).toBe(false);
  });
});

describe('Clients Utils: Yup Schemas', () => {

  it('BaseClientSchema waliduje imię (min 2 znaki)', async () => {
    await expect(
      BaseClientSchema.validate({
        first_name: 'J',
        last_name: 'Kowalski',
        is_active: true,
      }),
    ).rejects.toMatchObject({ name: 'ValidationError', path: 'first_name' });

    await expect(
      BaseClientSchema.validate({
        first_name: 'Jan',
        last_name: 'Kowalski',
        is_active: true,
      }),
    ).resolves.toBeTruthy();
  });

  it('BaseClientSchema: telefon nie jest walidowany restrykcyjnie (realna implementacja)', async () => {
    // Ten test jest DOWODOWY: pokazuje faktyczne zachowanie schematu,
    // zamiast wymuszać regułę, której w kodzie nie ma.
    await expect(
      BaseClientSchema.validate({
        first_name: 'Jan',
        last_name: 'Kowalski',
        is_active: true,
        phone: '123',
      }),
    ).resolves.toBeTruthy();
  });

  it('CreateClientSchema wymaga hasła', async () => {
    await expect(
      CreateClientSchema.validate({
        first_name: 'Jan',
        last_name: 'Kowalski',
        is_active: true,
      }),
    ).rejects.toMatchObject({ name: 'ValidationError', path: 'password' });
  });

  it('CreateClientSchema wymaga hasła min 8 znaków', async () => {
    await expect(
      CreateClientSchema.validate({
        first_name: 'Jan',
        last_name: 'Kowalski',
        is_active: true,
        password: '1234567', // 7 znaków
      }),
    ).rejects.toMatchObject({ name: 'ValidationError', path: 'password' });
  });
});
