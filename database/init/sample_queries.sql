-- 1) Użytkownicy i nadane kody
SELECT id, email, role, code, created_at FROM core.users ORDER BY role, email;

-- 2) Oferta usług
SELECT s.name, c.name AS category, s.base_price_gross, s.duration_min, s.is_active, s.promo_flag
FROM ops.services s
LEFT JOIN ops.service_categories c ON c.id = s.category_id
ORDER BY c.name, s.name;

-- 3) Kalendarz wizyt na 7 dni
SELECT a.id, a.start_at, a.end_at, a.status,
       (cl.first_name||' '||cl.last_name) AS client,
       (e.first_name||' '||e.last_name)   AS employee
FROM ops.appointments a
LEFT JOIN core.clients cl   ON cl.id = a.client_id
LEFT JOIN core.employees e  ON e.id  = a.employee_id
WHERE a.start_at >= now() AND a.start_at < now() + interval '7 days'
ORDER BY a.start_at;

-- 4) Próba wstawienia wizyty nachodzącej (powinien polecieć błąd triggera)
-- !!! Uruchamiaj świadomie, aby zobaczyć błąd integralności.
-- WITH e AS (SELECT id AS employee_id FROM core.employees LIMIT 1)
-- INSERT INTO ops.appointments(employee_id, status, start_at, end_at)
-- SELECT e.employee_id, 'scheduled',
--        date_trunc('hour', now() + interval '1 day') + interval '10 hour',
--        date_trunc('hour', now() + interval '1 day') + interval '11 hour'
-- FROM e;

-- 5) Raport: przychód miesięczny
SELECT * FROM ops.v_revenue_monthly;

-- 6) Raport: wykorzystanie pracowników (godziny zarezerwowane / miesiąc)
SELECT * FROM ops.v_employee_utilization ORDER BY month, employee_name;

-- 7) Top usługi (przychód)
SELECT s.name, SUM(ai.price_gross) AS revenue
FROM ops.appointment_items ai
JOIN ops.services s ON s.id = ai.service_id
GROUP BY s.name
ORDER BY revenue DESC;

-- 8) Log audytu — ostatnie 40 operacji
SELECT occurred_at, table_name, operation, row_pk
FROM audit.audit_log
ORDER BY occurred_at DESC
LIMIT 40;
