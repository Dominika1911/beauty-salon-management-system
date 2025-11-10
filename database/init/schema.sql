-- Beauty Salon Management System — SCHEMA (PRO)
-- Encoding: UTF-8

-- ==============
-- 0) Extensions
-- ==============
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

-- =========
-- 1) Schemas
-- =========
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS ops;
CREATE SCHEMA IF NOT EXISTS audit;

-- ==========
-- 2) Types
-- ==========
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='user_role') THEN
    CREATE TYPE core.user_role AS ENUM ('admin','employee','client');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='appointment_status') THEN
    CREATE TYPE ops.appointment_status AS ENUM (
      'draft','scheduled','confirmed','in_service','completed','no_show','canceled'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='payment_method') THEN
    CREATE TYPE ops.payment_method AS ENUM ('cash','card','transfer','blik','other');
  END IF;
END $$;

-- ===================
-- 3) Core (master data)
-- ===================
CREATE TABLE IF NOT EXISTS core.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT UNIQUE,
  phone         VARCHAR(32),
  password_hash TEXT NOT NULL,
  role          core.user_role NOT NULL,
  code          TEXT UNIQUE,              -- ADM-0001 / EMP-0001 / CLI-0001
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE REFERENCES core.users(id) ON DELETE SET NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  birth_date      DATE,
  notes           TEXT,
  gdpr_consent_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.employees (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID UNIQUE REFERENCES core.users(id) ON DELETE SET NULL,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  hire_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Global settings (JSON), np. slot czasowy, bufor, polityka zaliczek
CREATE TABLE IF NOT EXISTS core.settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ======================
-- 4) Ops (offer & schedule)
-- ======================
CREATE TABLE IF NOT EXISTS ops.service_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS ops.services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      UUID REFERENCES ops.service_categories(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  base_price_gross NUMERIC(10,2) NOT NULL CHECK (base_price_gross >= 0),
  duration_min     INTEGER NOT NULL CHECK (duration_min > 0),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  promo_flag       BOOLEAN NOT NULL DEFAULT FALSE,
  image_url        TEXT,
  UNIQUE (category_id, name)
);

-- Kto może wykonywać daną usługę
CREATE TABLE IF NOT EXISTS ops.employee_services (
  employee_id    UUID NOT NULL REFERENCES core.employees(id) ON DELETE CASCADE,
  service_id     UUID NOT NULL REFERENCES ops.services(id)   ON DELETE CASCADE,
  level          TEXT,                         -- np. junior/senior
  price_modifier NUMERIC(5,2) DEFAULT 1.00 CHECK (price_modifier > 0),
  PRIMARY KEY (employee_id, service_id)
);

-- Stanowiska/stanowiska pracy
CREATE TABLE IF NOT EXISTS ops.workstations (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL UNIQUE,
  notes TEXT
);

-- Grafiki pracy
CREATE TABLE IF NOT EXISTS ops.working_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES core.employees(id) ON DELETE CASCADE,
  weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Sunday
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  CHECK (end_time > start_time),
  UNIQUE (employee_id, weekday)
);

-- Urlopy / przerwy
CREATE TABLE IF NOT EXISTS ops.time_off (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES core.employees(id) ON DELETE CASCADE,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ NOT NULL,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending/approved/rejected
  CHECK (end_at > start_at)
);

-- Rezerwacje
CREATE TABLE IF NOT EXISTS ops.appointments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID REFERENCES core.clients(id)    ON DELETE SET NULL,
  employee_id    UUID REFERENCES core.employees(id)  ON DELETE SET NULL,
  workstation_id UUID REFERENCES ops.workstations(id) ON DELETE SET NULL,
  status         ops.appointment_status NOT NULL DEFAULT 'scheduled',
  start_at       TIMESTAMPTZ NOT NULL,
  end_at         TIMESTAMPTZ NOT NULL,
  notes          TEXT,
  created_by     UUID REFERENCES core.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

-- Pozycje wizyty (wiele usług w jednej wizycie)
CREATE TABLE IF NOT EXISTS ops.appointment_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES ops.appointments(id) ON DELETE CASCADE,
  service_id     UUID NOT NULL REFERENCES ops.services(id) ON DELETE RESTRICT,
  price_gross    NUMERIC(10,2) NOT NULL CHECK (price_gross >= 0),
  duration_min   INTEGER NOT NULL CHECK (duration_min > 0),
  position       INTEGER NOT NULL DEFAULT 1,
  UNIQUE (appointment_id, position)
);

-- Notatki do wizyty + historia statusów
CREATE TABLE IF NOT EXISTS ops.appointment_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES ops.appointments(id) ON DELETE CASCADE,
  author_id      UUID REFERENCES core.users(id),
  note           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.appointment_status_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES ops.appointments(id) ON DELETE CASCADE,
  old_status     ops.appointment_status,
  new_status     ops.appointment_status NOT NULL,
  changed_by     UUID REFERENCES core.users(id),
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Płatności i faktury
CREATE TABLE IF NOT EXISTS ops.payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES ops.appointments(id) ON DELETE SET NULL,
  amount_gross   NUMERIC(10,2) NOT NULL CHECK (amount_gross >= 0),
  method         ops.payment_method NOT NULL,
  paid_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference      TEXT
);

CREATE TABLE IF NOT EXISTS ops.invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number        TEXT NOT NULL UNIQUE,
  client_id     UUID REFERENCES core.clients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES ops.appointments(id) ON DELETE SET NULL,
  issue_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  total_gross   NUMERIC(10,2) NOT NULL CHECK (total_gross >= 0),
  vat_rate      NUMERIC(4,2) NOT NULL DEFAULT 23.00 CHECK (vat_rate >= 0),
  pdf_url       TEXT
);

-- Opinie (po jednej na wizytę)
CREATE TABLE IF NOT EXISTS ops.reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID UNIQUE REFERENCES ops.appointments(id) ON DELETE SET NULL,
  rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============
-- 5) AUDIT LOG
-- ==============
CREATE TABLE IF NOT EXISTS audit.audit_log (
  id          BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  table_name  TEXT NOT NULL,
  operation   TEXT NOT NULL,  -- INSERT/UPDATE/DELETE
  user_id     UUID,
  row_pk      TEXT,
  old_data    JSONB,
  new_data    JSONB
);

CREATE OR REPLACE FUNCTION audit.log_change()
RETURNS TRIGGER AS $$
DECLARE v_user UUID;
BEGIN
  -- (opcjonalnie) mapowanie current_user→core.users.email jeśli używasz loginów DB
  SELECT u.id INTO v_user FROM core.users u WHERE u.email = current_user::text LIMIT 1;

  IF TG_OP='INSERT' THEN
    INSERT INTO audit.audit_log(table_name,operation,user_id,row_pk,new_data)
    VALUES (TG_TABLE_NAME,TG_OP,v_user, to_jsonb(NEW)->>'id', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP='UPDATE' THEN
    INSERT INTO audit.audit_log(table_name,operation,user_id,row_pk,old_data,new_data)
    VALUES (TG_TABLE_NAME,TG_OP,v_user, to_jsonb(NEW)->>'id', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE -- DELETE
    INSERT INTO audit.audit_log(table_name,operation,user_id,row_pk,old_data)
    VALUES (TG_TABLE_NAME,TG_OP,v_user, to_jsonb(OLD)->>'id', to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Podpinamy audyt do wszystkich tabel biznesowych
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname IN ('core','ops')
  LOOP
    EXECUTE format($f$
      DO $g$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname=%L) THEN
          CREATE TRIGGER %I
          AFTER INSERT OR UPDATE OR DELETE ON %I.%I
          FOR EACH ROW EXECUTE FUNCTION audit.log_change();
        END IF;
      END $g$;
    $f$, 'tr_audit_'||r.tablename, 'tr_audit_'||r.tablename, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ==========================
-- 6) Integrity helpers & triggers
-- ==========================

-- Aktualizacja updated_at
CREATE OR REPLACE FUNCTION core.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE (schemaname, tablename) IN
      ( ('core','users'), ('core','clients'), ('core','employees'),
        ('ops','appointments') )
  LOOP
    EXECUTE format($f$
      DO $g$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname=%L) THEN
          CREATE TRIGGER %I
          BEFORE UPDATE ON %I.%I
          FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
        END IF;
      END $g$;
    $f$, 'tr_'||r.tablename||'_updated_at', 'tr_'||r.tablename||'_updated_at', r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Blokada nakładania się wizyt (pracownik / stanowisko)
CREATE OR REPLACE FUNCTION ops.prevent_overlaps()
RETURNS TRIGGER AS $$
BEGIN
  -- Employee overlap
  IF NEW.employee_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM ops.appointments a
    WHERE a.id <> COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000')
      AND a.employee_id = NEW.employee_id
      AND a.status NOT IN ('canceled','no_show')
      AND tstzrange(a.start_at,a.end_at,'[)') && tstzrange(NEW.start_at,NEW.end_at,'[)')
  ) THEN
    RAISE EXCEPTION 'Overlapping appointment for employee %', NEW.employee_id
      USING ERRCODE = 'unique_violation';
  END IF;

  -- Workstation overlap
  IF NEW.workstation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM ops.appointments a
    WHERE a.id <> COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000')
      AND a.workstation_id = NEW.workstation_id
      AND a.status NOT IN ('canceled','no_show')
      AND tstzrange(a.start_at,a.end_at,'[)') && tstzrange(NEW.start_at,NEW.end_at,'[)')
  ) THEN
    RAISE EXCEPTION 'Overlapping appointment at workstation %', NEW.workstation_id
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tr_appt_prevent_overlaps') THEN
    CREATE TRIGGER tr_appt_prevent_overlaps
    BEFORE INSERT OR UPDATE ON ops.appointments
    FOR EACH ROW EXECUTE FUNCTION ops.prevent_overlaps();
  END IF;
END $$;

-- Automatyczne nadawanie kodów ADM/EMP/CLI
CREATE SEQUENCE IF NOT EXISTS core.seq_admin_code START 1;
CREATE SEQUENCE IF NOT EXISTS core.seq_employee_code START 1;
CREATE SEQUENCE IF NOT EXISTS core.seq_client_code START 1;

CREATE OR REPLACE FUNCTION core.assign_user_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role = 'admin' THEN
    NEW.code := 'ADM-' || LPAD(nextval('core.seq_admin_code')::text, 4, '0');
  ELSIF NEW.role = 'employee' THEN
    NEW.code := 'EMP-' || LPAD(nextval('core.seq_employee_code')::text, 4, '0');
  ELSIF NEW.role = 'client' THEN
    NEW.code := 'CLI-' || LPAD(nextval('core.seq_client_code')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tr_users_assign_code') THEN
    CREATE TRIGGER tr_users_assign_code
    BEFORE INSERT ON core.users
    FOR EACH ROW EXECUTE FUNCTION core.assign_user_code();
  END IF;
END $$;

-- ===========
-- 7) Indexes
-- ===========
CREATE INDEX IF NOT EXISTS idx_users_role ON core.users(role);
CREATE INDEX IF NOT EXISTS idx_clients_name ON core.clients(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_employees_active ON core.employees(is_active);
CREATE INDEX IF NOT EXISTS idx_services_active ON ops.services(is_active);
CREATE INDEX IF NOT EXISTS idx_appt_times ON ops.appointments(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_appt_status ON ops.appointments(status);
CREATE INDEX IF NOT EXISTS idx_payments_apt ON ops.payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON ops.reviews(rating);

-- =========
-- 8) Views
-- =========
CREATE OR REPLACE VIEW ops.v_employee_utilization AS
SELECT
  e.id AS employee_id,
  e.first_name || ' ' || e.last_name AS employee_name,
  date_trunc('month', a.start_at) AS month,
  SUM(EXTRACT(EPOCH FROM (a.end_at - a.start_at))/3600.0) AS hours_booked
FROM core.employees e
LEFT JOIN ops.appointments a
  ON a.employee_id = e.id AND a.status IN ('confirmed','in_service','completed')
GROUP BY e.id, employee_name, date_trunc('month', a.start_at);

CREATE OR REPLACE VIEW ops.v_revenue_monthly AS
SELECT
  date_trunc('month', COALESCE(p.paid_at, a.start_at)) AS month,
  SUM(p.amount_gross) AS revenue_gross
FROM ops.appointments a
LEFT JOIN ops.payments p ON p.appointment_id = a.id
GROUP BY date_trunc('month', COALESCE(p.paid_at, a.start_at))
ORDER BY month;
