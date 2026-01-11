import { describe, expect, it } from 'vitest';

import { BaseClientSchema, CreateClientSchema } from '@/pages/Admin/Clients/utils';

describe('Walidacja formularza klienta (Yup schemas)', () => {
    it('BaseClientSchema: wymaga imienia i nazwiska oraz waliduje telefon/email, gdy są podane', async () => {
        const valid = {
            first_name: 'Jan',
            last_name: 'Kowalski',
            phone: '+48123456789',
            email: 'jan.kowalski@example.com',
            internal_notes: 'Notatka',
            is_active: true,
        };

        await expect(BaseClientSchema.validate(valid)).resolves.toEqual(valid);

        const invalid = {
            ...valid,
            first_name: 'J',
            last_name: '',
            phone: '123 456 789',
            email: 'not-an-email',
        };

        await expect(BaseClientSchema.validate(invalid, { abortEarly: false })).rejects.toMatchObject({
            name: 'ValidationError',
        });
    });

    it('CreateClientSchema: pozwala na pusty telefon/email (opcjonalne) i wymaga hasła min. 8 znaków', async () => {
        const base = {
            first_name: 'Anna',
            last_name: 'Nowak',
            phone: '',
            email: '',
            internal_notes: '',
            is_active: true,
        };

        // brak hasła
        await expect(CreateClientSchema.validate(base)).rejects.toMatchObject({ name: 'ValidationError' });

        // hasło za krótkie
        await expect(CreateClientSchema.validate({ ...base, password: '1234567' }, { abortEarly: false })).rejects.toMatchObject(
            { name: 'ValidationError' },
        );

        // poprawne hasło
        await expect(CreateClientSchema.validate({ ...base, password: '12345678' })).resolves.toMatchObject({
            first_name: 'Anna',
            last_name: 'Nowak',
        });
    });
});
