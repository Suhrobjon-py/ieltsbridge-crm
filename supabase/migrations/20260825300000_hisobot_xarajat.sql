-- ============================================================
-- IELTSBridge CRM — hisobot va xarajatlar (2026-08-25, 3-migratsiya)
-- 1) expenses         — markaz sarf-xarajatlari
-- 2) teacher_salaries — o'qituvchilarga to'langan oylik maoshlar
-- 3) leads.source     — 'otib_ketgan' o'rniga 'dostlar'
-- ============================================================

CREATE TABLE expenses (
    id       SERIAL PRIMARY KEY,
    name     TEXT NOT NULL,
    amount   NUMERIC(12,0) NOT NULL CHECK (amount >= 0),
    spent_at DATE NOT NULL DEFAULT CURRENT_DATE,
    note     TEXT
);

CREATE TABLE teacher_salaries (
    id         SERIAL PRIMARY KEY,
    teacher_id TEXT NOT NULL REFERENCES teachers(id),
    period     TEXT NOT NULL,               -- '2026-09'
    amount     NUMERIC(12,0) NOT NULL CHECK (amount >= 0),
    paid_at    DATE DEFAULT CURRENT_DATE,
    note       TEXT,
    UNIQUE (teacher_id, period)             -- bir oyga bitta yozuv; tahrirlash = upsert
);

CREATE INDEX idx_expenses_date  ON expenses(spent_at);
CREATE INDEX idx_salary_period  ON teacher_salaries(period);

-- Lid manbasi: 'otib_ketgan' -> 'dostlar'
ALTER TABLE leads DROP CONSTRAINT leads_source_check;
UPDATE leads SET source = 'dostlar' WHERE source = 'otib_ketgan';
ALTER TABLE leads ADD CONSTRAINT leads_source_check
    CHECK (source IN ('instagram','telegram','tavsiya','dostlar','boshqa'));

-- RLS (xodimlar uchun to'liq ruxsat, boshqa jadvallar bilan bir xil)
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_all ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE teacher_salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_all ON teacher_salaries FOR ALL TO authenticated USING (true) WITH CHECK (true);
