INSERT INTO core.settings(key, value) VALUES
('time_slot',   '{"minutes":30}'),                        
('gap_buffer',  '{"minutes":10}'),                        
('deposit_policy', '{"required":true,"amount":50.00,"free_cancel_hours":24}'), 
('notifications', '{"reminder_hours":[24,3]}' )          
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

INSERT INTO core.users(email, phone, password_hash, role, is_active)
VALUES
('admin@salon.local',     '+48 600 000 000', 'hash-admin', 'admin',    TRUE),
('pracownik@salon.local', '+48 600 000 001', 'hash-emp',   'employee', TRUE),
('klient@salon.local',    '+48 600 000 002', 'hash-cli',   'client',   TRUE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO core.employees(user_id, first_name, last_name)
SELECT id, 'Anna', 'Nowak' FROM core.users WHERE email='pracownik@salon.local'
ON CONFLICT DO NOTHING;

INSERT INTO core.clients(user_id, first_name, last_name, gdpr_consent_at)
SELECT id, 'Dominika', 'Jedynak', now() FROM core.users WHERE email='klient@salon.local'
ON CONFLICT DO NOTHING;

INSERT INTO ops.service_categories(name, description) VALUES
('Paznokcie','Usługi manicure/pedicure'),
('Brwi i rzęsy','Stylizacja brwi i rzęs')
ON CONFLICT DO NOTHING;

INSERT INTO ops.services(category_id, name, description, base_price_gross, duration_min, is_active, promo_flag)
SELECT sc.id, 'Manicure hybrydowy', 'Manicure z lakierem hybrydowym', 120.00, 60, TRUE, FALSE
FROM ops.service_categories sc WHERE sc.name='Paznokcie'
ON CONFLICT DO NOTHING;

INSERT INTO ops.services(category_id, name, description, base_price_gross, duration_min, is_active, promo_flag)
SELECT sc.id, 'Stylizacja brwi', 'Regulacja + farbka', 80.00, 30, TRUE, TRUE
FROM ops.service_categories sc WHERE sc.name='Brwi i rzęsy'
ON CONFLICT DO NOTHING;

INSERT INTO ops.employee_services(employee_id, service_id, level, price_modifier)
SELECT e.id, s.id, 'senior', 1.00
FROM core.employees e, ops.services s
ON CONFLICT DO NOTHING;

INSERT INTO ops.workstations(name) VALUES ('Stanowisko 1') ON CONFLICT DO NOTHING;

WITH c AS (SELECT id AS client_id FROM core.clients LIMIT 1),
     e AS (SELECT id AS employee_id FROM core.employees LIMIT 1),
     w AS (SELECT id AS workstation_id FROM ops.workstations LIMIT 1)
INSERT INTO ops.appointments(client_id, employee_id, workstation_id, status, start_at, end_at, created_by, notes)
SELECT c.client_id, e.employee_id, w.workstation_id, 'confirmed',
       date_trunc('hour', now() + interval '1 day') + interval '10 hour',
       date_trunc('hour', now() + interval '1 day') + interval '11 hour',
       (SELECT id FROM core.users WHERE email='admin@salon.local'),
       'Wizyta testowa'
FROM c,e,w
ON CONFLICT DO NOTHING;

INSERT INTO ops.appointment_items(appointment_id, service_id, price_gross, duration_min, position)
SELECT a.id, s.id, s.base_price_gross, s.duration_min, 1
FROM ops.appointments a
JOIN ops.services s ON s.name='Manicure hybrydowy'
ORDER BY a.created_at DESC
LIMIT 1;

INSERT INTO ops.payments(appointment_id, amount_gross, method, reference)
SELECT a.id, 50.00, 'card', 'DEPOSIT-TEST'
FROM ops.appointments a
ORDER BY a.created_at DESC
LIMIT 1;

INSERT INTO ops.invoices(number, client_id, appointment_id, issue_date, total_gross, vat_rate)
SELECT NULL, a.client_id, a.id, CURRENT_DATE, 120.00, 23.00
FROM ops.appointments a
ORDER BY a.created_at DESC
LIMIT 1;
