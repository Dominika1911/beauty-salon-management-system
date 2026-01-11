import { describe, it, expect } from 'vitest';

import {
    buildServicePayload,
    extractDrfMessage,
    getBestErrorMessage,
    validateServiceForm,
} from './utils';

describe('pages/Admin/Services/utils', () => {
    describe('validateServiceForm()', () => {
        it('dla pustych pól zwraca valid=false i konkretne komunikaty w errors', () => {
            const res = validateServiceForm({
                name: '',
                category: '',
                description: '',
                price: '',
                duration_minutes: '',
                is_active: true,
            });

            expect(res.valid).toBe(false);
            expect(res.errors).toEqual({
                name: 'Nazwa jest wymagana.',
                price: 'Cena jest wymagana.',
                duration_minutes: 'Czas trwania jest wymagany.',
            });
        });

        it('dla poprawnych danych zwraca valid=true i pusty errors', () => {
            const res = validateServiceForm({
                name: 'A',
                category: '',
                description: '',
                price: '10.00',
                duration_minutes: '30',
                is_active: true,
            });

            expect(res.valid).toBe(true);
            expect(res.errors).toEqual({});
        });

        it('odrzuca ujemną cenę', () => {
            const res = validateServiceForm({
                name: 'A',
                category: '',
                description: '',
                price: '-1',
                duration_minutes: '30',
                is_active: true,
            });

            expect(res.valid).toBe(false);
            expect(res.errors.price).toBe('Cena musi być liczbą ≥ 0.');
        });

        it('odrzuca czas trwania < 5', () => {
            const res = validateServiceForm({
                name: 'A',
                category: '',
                description: '',
                price: '10',
                duration_minutes: '4',
                is_active: true,
            });

            expect(res.valid).toBe(false);
            expect(res.errors.duration_minutes).toBe('Czas trwania musi być ≥ 5 minut.');
        });
    });

    describe('buildServicePayload()', () => {
        it('trimuje pola i mapuje opcjonalne na undefined, duration_minutes na number', () => {
            const payload = buildServicePayload({
                name: '  Nazwa  ',
                category: '   ',
                description: '  Opis  ',
                price: '10.00',
                duration_minutes: '30',
                is_active: false,
            });

            expect(payload).toEqual({
                name: 'Nazwa',
                category: undefined,
                description: 'Opis',
                price: '10.00',
                duration_minutes: 30,
                is_active: false,
            });
        });
    });

    describe('extractDrfMessage()', () => {
        it('wyciąga detail jeśli istnieje', () => {
            expect(extractDrfMessage({ detail: 'X' })).toBe('X');
        });

        it('wyciąga pierwszy non_field_errors jeśli istnieje', () => {
            expect(extractDrfMessage({ non_field_errors: ['A', 'B'] })).toBe('A');
        });

        it('gdy data jest stringiem – zwraca string', () => {
            expect(extractDrfMessage('Oops')).toBe('Oops');
        });

        it('gdy data jest tablicą – zwraca pierwszy string', () => {
            expect(extractDrfMessage(['First', 'Second'])).toBe('First');
        });

        it('gdy nie ma detail/non_field_errors, ale obiekt ma stringową wartość – zwraca tę wartość', () => {
            expect(extractDrfMessage({ foo: 'bar' } as unknown)).toBe('bar');
        });
    });

    describe('getBestErrorMessage()', () => {
        it('gdy parseDrfError ma message (detail/non_field) -> zwraca message', () => {
            const msg = getBestErrorMessage(
                { response: { data: { detail: 'Forbidden' } } } as unknown
            );
            expect(msg).toBe('Forbidden');
        });

        it('gdy parseDrfError nie ma message, ale response.data ma pole z tablicą -> wyciąga pierwszy string (extractDrfMessage)', () => {
            const msg = getBestErrorMessage(
                { response: { data: { name: ['To pole jest wymagane.'] } } } as unknown
            );
            expect(msg).toBe('To pole jest wymagane.');
        });

        it('fallback do Error.message, gdy brak response.data', () => {
            expect(getBestErrorMessage(new Error('Network'))).toBe('Network');
        });

        it('gdy nic nie pasuje – zwraca undefined lub ogólną informację (tu: undefined lub "Wystąpił błąd.")', () => {
            const msg = getBestErrorMessage({} as unknown);
            expect(msg).toBe('Wystąpił błąd.');
        });
    });
});
