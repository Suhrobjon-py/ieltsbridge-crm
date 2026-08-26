-- ============================================================
-- IELTSBridge CRM — qoidalar va rollar (2026-08-26, 4-migratsiya)
-- 1) Davomat qoidasi: 5 ketma-ket yoki jami 8 qoldirish -> chetlashtirish (avto)
--    3 ketma-ket -> ogohlantirish (ilova alert uchun v_davomat_holat)
-- 2) Final imtihon qoidasi: 1-urinish >89% o'tadi; 65-89% qayta topshiradi;
--    <65% bosqich takrorlaydi. 2-urinish >80% o'tadi, aks holda takrorlaydi.
-- 3) Superadmin/Admin rollari: o'chirish faqat superadminda (RLS darajasida)
-- 4) O'qituvchi: bosqich General/IELTS, daraja Main/Support; guruhda support o'qituvchi
-- 5) Maosh kalkulyatori uchun teacher_salaries ga student_count va rate
-- ============================================================

-- ---------- CHECK constraintlarni kengaytirish ----------

ALTER TABLE enrollments DROP CONSTRAINT enrollments_status_check;
ALTER TABLE enrollments ADD CONSTRAINT enrollments_status_check
    CHECK (status IN ('faol','yakunladi','kochirildi','tashlab_ketdi','chetlashtirildi'));

ALTER TABLE assessment_results DROP CONSTRAINT assessment_results_next_action_check;
ALTER TABLE assessment_results ADD CONSTRAINT assessment_results_next_action_check
    CHECK (next_action IN ('otdi_keyingi','qayta_topshiradi','moslashuv_2_hafta','bosqich_takrorlaydi'));

-- ---------- O'qituvchi: daraja va bosqichlar ----------

ALTER TABLE teachers ADD COLUMN degree TEXT NOT NULL DEFAULT 'main'
    CHECK (degree IN ('main','support'));

-- eski erkin matnli bosqichlarni General/IELTS ga o'tkazish
UPDATE teachers SET levels = CASE
    WHEN levels ILIKE '%IEL%' AND (levels ILIKE '%BEG%' OR levels ILIKE '%ELE%' OR levels ILIKE '%INT%'
         OR levels ILIKE '%UPP%' OR levels ILIKE '%ADV%' OR levels ILIKE '%General%') THEN 'General,IELTS'
    WHEN levels ILIKE '%IEL%' THEN 'IELTS'
    ELSE 'General'
END;

ALTER TABLE groups ADD COLUMN support_teacher_id TEXT REFERENCES teachers(id);

ALTER TABLE teacher_salaries ADD COLUMN student_count INT;
ALTER TABLE teacher_salaries ADD COLUMN rate NUMERIC(12,0);

-- ---------- 1) DAVOMAT QOIDASI ----------

-- Har davomat yozuvidan keyin tekshiradi: 5 ketma-ket 'kelmadi' yoki jami 8 ta
-- 'kelmadi' bo'lsa a'zolik avtomatik 'chetlashtirildi' ga o'tadi.
CREATE OR REPLACE FUNCTION davomat_qoidasi()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    g      TEXT;
    streak INT := 0;
    jami   INT;
    r      RECORD;
BEGIN
    SELECT s.group_id INTO g FROM sessions s WHERE s.id = NEW.session_id;
    IF g IS NULL THEN RETURN NEW; END IF;

    SELECT count(*) INTO jami
    FROM attendance a JOIN sessions s ON s.id = a.session_id
    WHERE a.student_id = NEW.student_id AND s.group_id = g AND a.status = 'kelmadi';

    FOR r IN
        SELECT COALESCE(a.status, '') AS st
        FROM sessions s
        LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = NEW.student_id
        WHERE s.group_id = g AND s.status = 'otildi'
        ORDER BY s.session_date DESC
    LOOP
        IF r.st = 'kelmadi' THEN streak := streak + 1; ELSE EXIT; END IF;
    END LOOP;

    IF streak >= 5 OR jami >= 8 THEN
        UPDATE enrollments
        SET status = 'chetlashtirildi', left_at = CURRENT_DATE
        WHERE student_id = NEW.student_id AND group_id = g AND status = 'faol';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_davomat ON attendance;
CREATE TRIGGER trg_davomat AFTER INSERT OR UPDATE ON attendance
FOR EACH ROW EXECUTE FUNCTION davomat_qoidasi();

-- Ilova va CRM uchun davomat holati (ogohlantirish 3 ketma-ketdan boshlanadi)
CREATE OR REPLACE VIEW v_davomat_holat WITH (security_invoker = true) AS
SELECT e.student_id,
       e.group_id,
       d.jami_qoldirgan,
       d.ketma_ket,
       (d.ketma_ket >= 3 AND d.ketma_ket < 5) AS ogohlantirish,
       GREATEST(0, 5 - d.ketma_ket) AS chetlashtirishgacha
FROM enrollments e
CROSS JOIN LATERAL (
    SELECT
        (SELECT count(*)
           FROM attendance a JOIN sessions s ON s.id = a.session_id
          WHERE a.student_id = e.student_id AND s.group_id = e.group_id
            AND a.status = 'kelmadi') AS jami_qoldirgan,
        COALESCE(
            (SELECT min(t.rn) - 1 FROM (
                SELECT row_number() OVER (ORDER BY s.session_date DESC) AS rn,
                       COALESCE(a.status, '') AS st
                FROM sessions s
                LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = e.student_id
                WHERE s.group_id = e.group_id AND s.status = 'otildi'
            ) t WHERE t.st <> 'kelmadi'),
            (SELECT count(*) FROM sessions s
              WHERE s.group_id = e.group_id AND s.status = 'otildi')
        ) AS ketma_ket
) d
WHERE e.status = 'faol';

-- ---------- 2) FINAL IMTIHON QOIDASI ----------

CREATE OR REPLACE FUNCTION natija_qoidasi()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    a assessments%ROWTYPE;
BEGIN
    SELECT * INTO a FROM assessments WHERE code = NEW.assessment_code;
    NEW.attempt_no := (SELECT count(*) + 1 FROM assessment_results
                        WHERE student_id = NEW.student_id
                          AND group_id  = NEW.group_id
                          AND assessment_code = NEW.assessment_code);
    IF a.a_type = 'final' THEN
        IF NEW.attempt_no = 1 THEN
            IF NEW.score_pct > 89 THEN
                NEW.passed := TRUE;  NEW.next_action := 'otdi_keyingi';
            ELSIF NEW.score_pct >= 65 THEN
                NEW.passed := FALSE; NEW.next_action := 'qayta_topshiradi';
            ELSE
                NEW.passed := FALSE; NEW.next_action := 'bosqich_takrorlaydi';
            END IF;
        ELSE
            IF NEW.score_pct > 80 THEN
                NEW.passed := TRUE;  NEW.next_action := 'otdi_keyingi';
            ELSE
                NEW.passed := FALSE; NEW.next_action := 'bosqich_takrorlaydi';
            END IF;
        END IF;
    ELSIF a.a_type = 'progress' THEN
        NEW.passed := NEW.score_pct >= COALESCE(a.pass_pct, 70);
        NEW.next_action := NULL;
    ELSE
        NEW.passed := TRUE;
        NEW.next_action := NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_natija ON assessment_results;
CREATE TRIGGER trg_natija BEFORE INSERT ON assessment_results
FOR EACH ROW EXECUTE FUNCTION natija_qoidasi();

-- ---------- 3) SUPERADMIN / ADMIN ROLLARI ----------

CREATE TABLE staff_roles (
    id    SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    role  TEXT NOT NULL CHECK (role IN ('superadmin','admin'))
);

-- birinchi superadmin (CRM admin akkauntingiz)
INSERT INTO staff_roles (email, role) VALUES ('suhrobjonsh98@gmail.com', 'superadmin');

CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM staff_roles
        WHERE lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
          AND role = 'superadmin'
    );
$$;

-- Barcha jadvallar: o'qish/qo'shish/tahrirlash — hamma xodimga,
-- O'CHIRISH — faqat superadminga.
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'levels','units','lessons','materials','vocabulary','homework','assessments',
        'leads','students','teachers','rooms','groups','enrollments','sessions',
        'attendance','homework_results','assessment_results','payments','rating_points',
        'app_users','app_user_students','notifications','expenses','teacher_salaries'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS staff_all ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS staff_select ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS staff_insert ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS staff_update ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS super_delete ON %I', t);
        EXECUTE format('CREATE POLICY staff_select ON %I FOR SELECT TO authenticated USING (true)', t);
        EXECUTE format('CREATE POLICY staff_insert ON %I FOR INSERT TO authenticated WITH CHECK (true)', t);
        EXECUTE format('CREATE POLICY staff_update ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t);
        EXECUTE format('CREATE POLICY super_delete ON %I FOR DELETE TO authenticated USING (is_superadmin())', t);
    END LOOP;
END $$;

ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_select ON staff_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY roles_insert ON staff_roles FOR INSERT TO authenticated WITH CHECK (is_superadmin());
CREATE POLICY roles_update ON staff_roles FOR UPDATE TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY roles_delete ON staff_roles FOR DELETE TO authenticated USING (is_superadmin());
