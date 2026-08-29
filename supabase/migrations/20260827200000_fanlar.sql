-- ============================================================
-- IELTSBridge CRM — fanlar tizimi (2026-08-27, 8-migratsiya)
-- O'quv markaz istalgan fan qo'sha oladi (Matematika, Rus tili...).
-- Lid va o'qituvchilar fanlarga bog'lanadi. Ingliz tili guruhlari
-- avvalgidek bosqich (BEG..IEL) dasturi bilan ishlayveradi.
-- ============================================================

CREATE TABLE subjects (
    id    SERIAL PRIMARY KEY,
    name  TEXT NOT NULL UNIQUE,
    faol  BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO subjects (name) VALUES ('General'), ('IELTS');

-- lidlar endi istalgan fanni ko'rsata oladi (ro'yxat subjects dan olinadi)
ALTER TABLE leads DROP CONSTRAINT leads_subject_check;

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_select ON subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY staff_insert ON subjects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY staff_update ON subjects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY super_delete ON subjects FOR DELETE TO authenticated USING (is_superadmin());
