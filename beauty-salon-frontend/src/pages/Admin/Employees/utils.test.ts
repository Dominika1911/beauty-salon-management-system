import { describe, it, expect } from 'vitest';
import {
  formatPLN,
  sortModelToOrdering,
  isEmployee,
  validateEmployeeForm,
  buildEmployeePayload,
  extractDrfMessage,
  mapEmployeeCreateMessage,
} from './utils';


describe('Employees Utils: formatPLN', () => {

  it('Formatuje poprawnie liczby na PLN', () => {
    const result = formatPLN(100);
    expect(result).toContain('100');
    expect(result).toContain('zł');
    expect(formatPLN(0)).toContain('0');
  });

  it('Formatuje stringi na PLN', () => {
    const result = formatPLN('100');
    expect(result).toContain('100');
    expect(result).toContain('zł');

    const result2 = formatPLN('1234.56');
    expect(result2).toContain('234');
    expect(result2).toContain('zł');
  });

  it('Obsługuje nieprawidłowe wartości', () => {
    expect(formatPLN('abc')).toContain('0');
    expect(formatPLN('not-a-number')).toContain('0');
  });

  it('Używa polskiego formatu z separatorem tysięcy', () => {
    const result = formatPLN(10000);
    // Ma separator (spacja lub nbsp)
    expect(result.length).toBeGreaterThan(10);
    expect(result).toContain('10');
    expect(result).toContain('000');
  });
});

describe('Employees Utils: sortModelToOrdering', () => {

  it('Konwertuje ascending sort', () => {
    expect(sortModelToOrdering([{ field: 'last_name', sort: 'asc' }])).toBe('last_name');
    expect(sortModelToOrdering([{ field: 'id', sort: 'asc' }])).toBe('id');
  });

  it('Konwertuje descending sort z prefiksem -', () => {
    expect(sortModelToOrdering([{ field: 'last_name', sort: 'desc' }])).toBe('-last_name');
    expect(sortModelToOrdering([{ field: 'created_at', sort: 'desc' }])).toBe('-created_at');
  });

  it('Zwraca undefined dla pustego modelu', () => {
    expect(sortModelToOrdering([])).toBeUndefined();
  });

  it('Zwraca undefined dla niedozwolonych pól', () => {
    expect(sortModelToOrdering([{ field: 'random_field', sort: 'asc' }])).toBeUndefined();
    expect(sortModelToOrdering([{ field: 'email', sort: 'desc' }])).toBeUndefined();
  });

  it('Akceptuje tylko dozwolone pola', () => {
    const allowed = ['id', 'employee_number', 'last_name', 'created_at'];

    allowed.forEach(field => {
      expect(sortModelToOrdering([{ field, sort: 'asc' }])).toBe(field);
    });
  });
});

describe('Employees Utils: validateEmployeeForm', () => {

  it('Walidacja przy tworzeniu - wymaga wszystkich pól', () => {
    const result = validateEmployeeForm({
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      phone: '',
      is_active: true,
      skill_ids: [],
    }, false);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.first_name).toBeTruthy();
      expect(result.fieldErrors?.last_name).toBeTruthy();
      expect(result.fieldErrors?.email).toBeTruthy();
      expect(result.fieldErrors?.password).toBeTruthy();
    }
  });

  it('Walidacja hasła - minimum 8 znaków', () => {
    const result = validateEmployeeForm({
      first_name: 'Jan',
      last_name: 'Kowalski',
      email: 'jan@example.com',
      password: '1234567', // 7 znaków - za mało!
      phone: '',
      is_active: true,
      skill_ids: [],
    }, false);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.password).toContain('8');
    }
  });

  it('Akceptuje prawidłowy formularz przy tworzeniu', () => {
    const result = validateEmployeeForm({
      first_name: 'Jan',
      last_name: 'Kowalski',
      email: 'jan@example.com',
      password: '12345678',
      phone: '123456789',
      is_active: true,
      skill_ids: [1, 2],
    }, false);

    expect(result.ok).toBe(true);
  });

  it('Walidacja przy edycji - nie wymaga hasła i email', () => {
    const result = validateEmployeeForm({
      first_name: 'Jan',
      last_name: 'Kowalski',
      email: '',
      password: '',
      phone: '',
      is_active: true,
      skill_ids: [],
    }, true);

    expect(result.ok).toBe(true);
  });

  it('Walidacja przy edycji - nadal wymaga imienia i nazwiska', () => {
    const result = validateEmployeeForm({
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      phone: '',
      is_active: true,
      skill_ids: [],
    }, true);

    expect(result.ok).toBe(false);
  });
});

describe('Employees Utils: buildEmployeePayload', () => {

  it('Buduje payload dla nowego pracownika ze wszystkimi polami', () => {
    const form = {
      first_name: '  Jan  ',
      last_name: '  Kowalski  ',
      email: '  jan@example.com  ',
      password: 'Pass123!',
      phone: '  123456789  ',
      is_active: true,
      skill_ids: [1, 2, 3],
    };

    const payload = buildEmployeePayload(form, false);

    expect(payload.first_name).toBe('Jan'); // Trimmed
    expect(payload.last_name).toBe('Kowalski');
    expect(payload.email).toBe('jan@example.com');
    expect(payload.password).toBe('Pass123!');
    expect(payload.phone).toBe('123456789');
    expect(payload.is_active).toBe(true);
    expect(payload.skill_ids).toEqual([1, 2, 3]);
  });

  it('Buduje payload dla edycji bez email i hasła', () => {
    const form = {
      first_name: 'Jan',
      last_name: 'Kowalski',
      email: 'ignored@example.com',
      password: 'ignored',
      phone: '987654321',
      is_active: false,
      skill_ids: [4, 5],
    };

    const payload = buildEmployeePayload(form, true);

    expect(payload.first_name).toBe('Jan');
    expect(payload.last_name).toBe('Kowalski');
    expect('email' in payload).toBe(false); // Nie ma email
    expect('password' in payload).toBe(false); // Nie ma password
    expect(payload.phone).toBe('987654321');
    expect(payload.is_active).toBe(false);
  });

  it('Usuwa puste pole phone (zamienia na undefined)', () => {
    const form = {
      first_name: 'Jan',
      last_name: 'Kowalski',
      email: 'jan@test.com',
      password: 'Pass123!',
      phone: '   ',
      is_active: true,
      skill_ids: [],
    };

    const payload = buildEmployeePayload(form, false);
    expect(payload.phone).toBeUndefined();
  });
});

describe('Employees Utils: extractDrfMessage', () => {

  it('Wyciąga string bezpośrednio', () => {
    expect(extractDrfMessage('Error message')).toBe('Error message');
  });

  it('Wyciąga pierwszy element z array', () => {
    expect(extractDrfMessage(['First error', 'Second error'])).toBe('First error');
  });

  it('Wyciąga z pola detail', () => {
    expect(extractDrfMessage({ detail: 'Detail message' })).toBe('Detail message');
  });

  it('Wyciąga z pola non_field_errors', () => {
    expect(extractDrfMessage({ non_field_errors: ['Error 1'] })).toBe('Error 1');
  });

  it('Wyciąga z pola __all__', () => {
    expect(extractDrfMessage({ __all__: ['Global error'] })).toBe('Global error');
  });

  it('Wyciąga z pola 0', () => {
    expect(extractDrfMessage({ '0': 'First field error' })).toBe('First field error');
  });

  it('Zwraca undefined dla pustych danych', () => {
    expect(extractDrfMessage(null)).toBeUndefined();
    expect(extractDrfMessage(undefined)).toBeUndefined();
    expect(extractDrfMessage({})).toBeUndefined();
  });
});

describe('Employees Utils: mapEmployeeCreateMessage', () => {

  it('Mapuje błąd generowania loginu', () => {
    const msg = 'Nie można wygenerować unikalnego loginu';
    const result = mapEmployeeCreateMessage(msg);

    expect(result).toContain('system nie mógł wygenerować');
    expect(result).toContain('Spróbuj ponownie');
  });

  it('Mapuje błąd "już istnieje"', () => {
    const msg = 'Login już istnieje w systemie';
    const result = mapEmployeeCreateMessage(msg);

    expect(result).toContain('nie mógł wygenerować');
  });

  it('Przepuszcza inne błędy bez zmian', () => {
    const msg = 'Inny błąd walidacji';
    const result = mapEmployeeCreateMessage(msg);

    expect(result).toBe(msg);
  });

  it('Wykrywa słowa kluczowe case-insensitive', () => {
    const msg = 'nie mozna wygenerowac loginu';
    const result = mapEmployeeCreateMessage(msg);

    expect(result).toContain('system');
  });
});