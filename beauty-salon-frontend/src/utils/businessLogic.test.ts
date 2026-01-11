import { describe, expect, it } from 'vitest';

import {
    buildClientCreatePayload,
    buildClientUpdatePayload,
    normalizeClientValues,
} from '@/pages/Admin/Clients/utils';

type NormalizeInput = Parameters<typeof normalizeClientValues>[0];
type CreateInput = Parameters<typeof buildClientCreatePayload>[0];
type UpdateInput = Parameters<typeof buildClientUpdatePayload>[0];

describe('Admin/Clients/utils – normalizacja i budowanie payloadów', () => {
    it('normalizeClientValues: trimuje pola oraz mapuje puste wartości (phone → undefined, email → null)', () => {
        const values: NormalizeInput = {
            first_name: '  Jan  ',
            last_name: '  Kowalski ',
            phone: '   ',
            email: '   ',
            internal_notes: '  notatka  ',
            is_active: true,
            password: 'Pass123!',
        };

        expect(normalizeClientValues(values)).toEqual({
            first_name: 'Jan',
            last_name: 'Kowalski',
            phone: undefined, // kontrakt z kodu
            email: null, // kontrakt z kodu
            internal_notes: 'notatka',
            is_active: true,
            password: 'Pass123!',
        });
    });

    it('buildClientCreatePayload vs buildClientUpdatePayload: create zawiera password, update nie', () => {
        const values: CreateInput & UpdateInput = {
            first_name: ' Anna',
            last_name: 'Nowak ',
            phone: '+48123456789',
            email: 'anna.nowak@example.com ',
            internal_notes: '',
            is_active: false,
            password: 'Secret123!',
        };

        const createPayload = buildClientCreatePayload(values);
        const updatePayload = buildClientUpdatePayload(values);

        // Dowód: oba payloady są oparte o normalizację (trim email / imion)
        expect(createPayload).toMatchObject({
            first_name: 'Anna',
            last_name: 'Nowak',
            phone: '+48123456789',
            email: 'anna.nowak@example.com',
            internal_notes: '',
            is_active: false,
        });

        expect(updatePayload).toMatchObject({
            first_name: 'Anna',
            last_name: 'Nowak',
            phone: '+48123456789',
            email: 'anna.nowak@example.com',
            internal_notes: '',
            is_active: false,
        });

        // Dowód kontraktu: create ma password, update nie ma password
        expect(createPayload).toHaveProperty('password', 'Secret123!');
        expect(updatePayload).not.toHaveProperty('password');
    });

    it('normalizeClientValues: email zawsze jawne (string albo null), nigdy undefined', () => {
        const values: NormalizeInput = {
            first_name: 'Ala',
            last_name: 'Makota',
            is_active: true,
            // email celowo pomijamy
        };

        const out = normalizeClientValues(values);

        // Kontrakt z kodu: email zawsze istnieje na wyjściu (null jeśli brak/puste)
        expect(out).toHaveProperty('email');
        expect(out.email).toBeNull();
    });
});
