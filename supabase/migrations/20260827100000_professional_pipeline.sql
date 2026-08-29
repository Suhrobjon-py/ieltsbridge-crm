-- ============================================================
-- IELTSBridge CRM — professional lead pipeline (2026-08-27, 7-migratsiya)
-- LEAD → CONTACT → TRIAL → SALE → STUDENT → RISK → CHURN → WIN-BACK
-- 1) leads: 11 bosqichli pipeline, menejer, priority, follow-up, yo'qotish sababi
-- 2) lead_events: har lidning to'liq vaqt chizig'i (avto-jurnal triggerlari)
-- 3) trials: sinov darslari moduli (no-show sababi MAJBURIY, lid bilan sinxron)
-- 4) students: churn sababi + win-back pipeline
-- 5) v_student_risk: avtomatik Risk Score (0-100)
-- ============================================================

-- ---------- 1) LEADS PIPELINE ----------

ALTER TABLE leads ADD COLUMN parent_name TEXT;
ALTER TABLE leads ADD COLUMN manager TEXT;
ALTER TABLE leads ADD COLUMN priority TEXT NOT NULL DEFAULT 'orta' CHECK (priority IN ('past','orta','yuqori'));
ALTER TABLE leads ADD COLUMN interest TEXT CHECK (interest IN ('past','orta','yuqori'));
ALTER TABLE leads ADD COLUMN last_contact_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN next_followup_at DATE;
ALTER TABLE leads ADD COLUMN birth_year INT;
ALTER TABLE leads ADD COLUMN lost_reason TEXT CHECK (lost_reason IN
  ('narx_qimmat','ota_ona_maslahat','vaqt_mos_emas','oqituvchi_yoqmadi','kurs_yoqmadi',
   'boshqa_markaz','moliyaviy','keyinroq','aloqa_yoqolgan','boshqa'));

-- manba ro'yxatini marketing darajasiga kengaytirish
ALTER TABLE leads DROP CONSTRAINT leads_source_check;
UPDATE leads SET source = CASE source
    WHEN 'instagram' THEN 'instagram_organic'
    WHEN 'dostlar'   THEN 'tavsiya'
    ELSE source END;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (source IN
  ('instagram_ads','instagram_organic','telegram','facebook_ads','google_ads',
   'website','telefon','tavsiya','offline','hamkor','boshqa'));

-- 11 bosqichli pipeline holati
ALTER TABLE leads DROP CONSTRAINT leads_status_check;
UPDATE leads SET status = CASE
    WHEN status = 'yozildi'  THEN 'sotuv_yopildi'
    WHEN status = 'kelmaydi' THEN 'rad_etdi'
    ELSE 'yangi' END;
UPDATE leads SET lost_reason = 'boshqa' WHERE status = 'rad_etdi' AND lost_reason IS NULL;
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN
  ('yangi','birinchi_aloqa','boglanib_bolmadi','aloqa_ornatildi','qiziqish_bildirdi',
   'sinovga_yozildi','sinovga_keldi','taklif_berildi','qaror_kutilmoqda','sotuv_yopildi','rad_etdi'));
ALTER TABLE leads ADD CONSTRAINT rad_sabab_shart
  CHECK (status <> 'rad_etdi' OR lost_reason IS NOT NULL);

-- ---------- 2) LEAD TIMELINE (avto-jurnal) ----------

CREATE TABLE lead_events (
    id         SERIAL PRIMARY KEY,
    lead_id    TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,   -- yaratildi/status/qongiroq/sms/izoh/sinov/sotuv/menejer
    body       TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_levents_lead ON lead_events(lead_id, created_at);

CREATE OR REPLACE FUNCTION lead_jurnal()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO lead_events (lead_id, event_type, body, created_by)
        VALUES (NEW.id, 'yaratildi', 'Lid yaratildi · manba: ' || NEW.source, auth.jwt()->>'email');
    ELSE
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            INSERT INTO lead_events (lead_id, event_type, body, created_by)
            VALUES (NEW.id, 'status', OLD.status || ' → ' || NEW.status, auth.jwt()->>'email');
        END IF;
        IF NEW.manager IS DISTINCT FROM OLD.manager AND NEW.manager IS NOT NULL THEN
            INSERT INTO lead_events (lead_id, event_type, body, created_by)
            VALUES (NEW.id, 'menejer', 'Menejer tayinlandi: ' || NEW.manager, auth.jwt()->>'email');
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lead_ins ON leads;
CREATE TRIGGER trg_lead_ins AFTER INSERT ON leads FOR EACH ROW EXECUTE FUNCTION lead_jurnal();
DROP TRIGGER IF EXISTS trg_lead_upd ON leads;
CREATE TRIGGER trg_lead_upd AFTER UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION lead_jurnal();

-- ---------- 3) SINOV DARSLARI (trials) ----------

CREATE TABLE trials (
    id            SERIAL PRIMARY KEY,
    lead_id       TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    group_id      TEXT REFERENCES groups(id),
    teacher_id    TEXT REFERENCES teachers(id),
    trial_date    DATE NOT NULL,
    trial_time    TIME,
    status        TEXT NOT NULL DEFAULT 'yozildi' CHECK (status IN
      ('yozildi','tasdiqlandi','eslatma_yuborildi','keldi','kelmadi','qayta_yozildi','muvaffaqiyatli','sotuvga_otkazildi')),
    noshow_reason TEXT CHECK (noshow_reason IN
      ('unutgan','vaqt_mos_kelmadi','transport','qiziqish_kamaydi','ota_ona_ruxsat_bermadi',
       'narx_qimmat','boshqa_markaz','aloqa_bolmadi','nomalum','boshqa')),
    feedback      TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT noshow_sabab_shart CHECK (status <> 'kelmadi' OR noshow_reason IS NOT NULL)
);
CREATE INDEX idx_trials_lead ON trials(lead_id);
CREATE INDEX idx_trials_date ON trials(trial_date);

-- sinov holati o'zgarsa lid pipeline'i sinxron yangilanadi + jurnal
CREATE OR REPLACE FUNCTION trial_sync()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lbl TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE leads SET status = 'sinovga_yozildi'
         WHERE id = NEW.lead_id
           AND status IN ('yangi','birinchi_aloqa','boglanib_bolmadi','aloqa_ornatildi','qiziqish_bildirdi');
        INSERT INTO lead_events (lead_id, event_type, body)
        VALUES (NEW.lead_id, 'sinov', 'Sinov darsiga yozildi: ' || NEW.trial_date::text ||
                COALESCE(' ' || left(NEW.trial_time::text, 5), ''));
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status = 'keldi' THEN
            UPDATE leads SET status = 'sinovga_keldi'
             WHERE id = NEW.lead_id
               AND status IN ('yangi','birinchi_aloqa','boglanib_bolmadi','aloqa_ornatildi','qiziqish_bildirdi','sinovga_yozildi');
            lbl := 'Sinov darsiga KELDI';
        ELSIF NEW.status = 'kelmadi' THEN
            lbl := 'Sinovga KELMADI · sabab: ' || COALESCE(NEW.noshow_reason, '-');
        ELSIF NEW.status = 'qayta_yozildi' THEN
            lbl := 'Sinov qayta belgilandi';
        ELSE
            lbl := 'Sinov holati: ' || NEW.status;
        END IF;
        INSERT INTO lead_events (lead_id, event_type, body) VALUES (NEW.lead_id, 'sinov', lbl);
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_trial ON trials;
CREATE TRIGGER trg_trial AFTER INSERT OR UPDATE ON trials FOR EACH ROW EXECUTE FUNCTION trial_sync();

-- ---------- 4) CHURN va WIN-BACK ----------

ALTER TABLE students ADD COLUMN churn_reason TEXT CHECK (churn_reason IN
  ('narx','oqituvchi','davomat','natija_yoq','vaqt_mos_emas','kochib_ketdi',
   'boshqa_markaz','moliyaviy','shaxsiy','boshqa'));
ALTER TABLE students ADD COLUMN churned_at DATE;
ALTER TABLE students ADD COLUMN winback TEXT CHECK (winback IN
  ('aloqa_qilindi','qiziqdi','taklif_berildi','qaytdi'));
UPDATE students SET churn_reason = 'boshqa', churned_at = CURRENT_DATE WHERE status = 'ketgan' AND churn_reason IS NULL;
ALTER TABLE students ADD CONSTRAINT churn_sabab_shart
  CHECK (status <> 'ketgan' OR churn_reason IS NOT NULL);

-- ---------- 5) RISK SCORE (0-100, avtomatik) ----------
-- 100=a'lo · 70-99=normal · 40-69=e'tibor kerak · 0-39=chiqib ketish xavfi
-- Omillar: 14 kunlik qoldirishlar, ketma-ket qoldirish, qarzdorlik, oxirgi kelgan kun

CREATE OR REPLACE VIEW v_student_risk WITH (security_invoker = true) AS
SELECT e.student_id,
       e.group_id,
       d.kelmagan_14,
       d.ketma_ket,
       d.qarz_bor,
       d.kelmagan_kun,
       GREATEST(0, LEAST(100,
           100
           - LEAST(36, d.kelmagan_14 * 12)
           - LEAST(24, d.ketma_ket * 8)
           - CASE WHEN d.qarz_bor THEN 25 ELSE 0 END
           - LEAST(15, GREATEST(0, d.kelmagan_kun - 7) * 2)
       ))::int AS score
FROM enrollments e
CROSS JOIN LATERAL (
    SELECT
        (SELECT count(*)::int FROM attendance a JOIN sessions s ON s.id = a.session_id
          WHERE a.student_id = e.student_id AND s.group_id = e.group_id
            AND a.status = 'kelmadi' AND s.session_date >= CURRENT_DATE - 14) AS kelmagan_14,
        COALESCE((SELECT min(t.rn) - 1 FROM (
            SELECT row_number() OVER (ORDER BY s.session_date DESC) AS rn,
                   COALESCE(a.status, '') AS st
            FROM sessions s
            LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = e.student_id
            WHERE s.group_id = e.group_id AND s.status = 'otildi'
          ) t WHERE t.st <> 'kelmadi'),
          (SELECT count(*)::int FROM sessions s WHERE s.group_id = e.group_id AND s.status = 'otildi')
        ) AS ketma_ket,
        EXISTS (SELECT 1 FROM payments p
          WHERE p.student_id = e.student_id AND p.group_id = e.group_id
            AND (p.status = 'muddati_otgan'
                 OR (p.period < to_char(CURRENT_DATE, 'YYYY-MM') AND p.status IN ('kutilmoqda','qisman')))) AS qarz_bor,
        CASE
          WHEN (SELECT count(*) FROM sessions s WHERE s.group_id = e.group_id AND s.status = 'otildi') = 0 THEN 0
          ELSE COALESCE((SELECT (CURRENT_DATE - max(s.session_date))::int
                           FROM attendance a JOIN sessions s ON s.id = a.session_id
                          WHERE a.student_id = e.student_id AND s.group_id = e.group_id
                            AND a.status IN ('keldi','kechikdi')), 999)
        END AS kelmagan_kun
) d
WHERE e.status = 'faol';

-- ---------- RLS: yangi jadvallar ----------

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['lead_events','trials']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY staff_select ON %I FOR SELECT TO authenticated USING (true)', t);
        EXECUTE format('CREATE POLICY staff_insert ON %I FOR INSERT TO authenticated WITH CHECK (true)', t);
        EXECUTE format('CREATE POLICY staff_update ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t);
        EXECUTE format('CREATE POLICY super_delete ON %I FOR DELETE TO authenticated USING (is_superadmin())', t);
    END LOOP;
END $$;
