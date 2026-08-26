-- ============================================================
-- IELTSBridge CRM — asosiy sxema (Supabase/PostgreSQL)
-- 22 jadval + funksiyalar + RLS siyosatlari
-- Manba model: Desktop\IELTSBridge_baza_sxemasi.sql (2026-08-25)
-- ============================================================

-- ================== KONTENT (o'quv dasturi) ==================

CREATE TABLE levels (
    code            TEXT PRIMARY KEY,          -- BEG, ELE, INT, UPP, ADV, IEL
    name            TEXT NOT NULL,
    cefr            TEXT NOT NULL,
    sort_order      INT  NOT NULL,
    duration_weeks  INT  NOT NULL DEFAULT 12,
    lessons_total   INT  NOT NULL DEFAULT 36,
    vocab_target    TEXT NOT NULL,
    outcome         TEXT NOT NULL,
    books           TEXT
);

CREATE TABLE units (
    code          TEXT PRIMARY KEY,            -- BEG-U01
    level_code    TEXT NOT NULL REFERENCES levels(code),
    unit_no       INT  NOT NULL,
    week_no       INT,
    is_reserve    BOOLEAN NOT NULL DEFAULT FALSE,
    title         TEXT,
    grammar_topic TEXT NOT NULL,
    vocab_topic   TEXT NOT NULL,
    skill_focus   TEXT NOT NULL,
    book_pages    TEXT,
    UNIQUE (level_code, unit_no)
);

CREATE TABLE lessons (
    code         TEXT PRIMARY KEY,             -- BEG-U01-L1
    unit_code    TEXT NOT NULL REFERENCES units(code),
    lesson_no    INT  NOT NULL CHECK (lesson_no BETWEEN 1 AND 3),
    lesson_type  TEXT NOT NULL CHECK (lesson_type IN ('yangi_mavzu','mustahkamlash','amaliyot')),
    title        TEXT,
    book_pages   TEXT,
    description  TEXT NOT NULL,
    duration_min INT  NOT NULL DEFAULT 90,
    UNIQUE (unit_code, lesson_no)
);

CREATE TABLE materials (
    code        TEXT PRIMARY KEY,              -- BEG-U01-L1-M1
    lesson_code TEXT NOT NULL REFERENCES lessons(code),
    mat_type    TEXT NOT NULL CHECK (mat_type IN ('audio','video','pdf','worksheet','kitob_sahifa','qr_video','rasm')),
    title       TEXT NOT NULL,
    source_ref  TEXT,
    url         TEXT,
    is_in_app   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE vocabulary (
    code       TEXT PRIMARY KEY,               -- BEG-U01-W01
    unit_code  TEXT NOT NULL REFERENCES units(code),
    word_en    TEXT NOT NULL,
    ipa        TEXT,
    word_uz    TEXT NOT NULL,
    example_en TEXT,
    audio_ref  TEXT
);

CREATE TABLE homework (
    code          TEXT PRIMARY KEY,            -- BEG-U01-L1-H1
    lesson_code   TEXT NOT NULL REFERENCES lessons(code),
    hw_type       TEXT NOT NULL CHECK (hw_type IN ('app_quiz','yozma','audio','oqish','lugat')),
    description   TEXT NOT NULL,
    max_score     INT  NOT NULL DEFAULT 10,
    deadline_days INT  NOT NULL DEFAULT 2
);

CREATE TABLE assessments (
    code           TEXT PRIMARY KEY,           -- BEG-MT01, BEG-PT1, BEG-FIN, IEL-DMK
    level_code     TEXT NOT NULL REFERENCES levels(code),
    a_type         TEXT NOT NULL CHECK (a_type IN ('mini','progress','final','mock')),
    title          TEXT NOT NULL,
    covers         TEXT NOT NULL,
    held_week      INT,
    held_lesson    TEXT,
    question_count TEXT,
    pass_pct       INT,
    note           TEXT
);

-- ================== ID KETMA-KETLIKLARI ==================

CREATE SEQUENCE stu_seq START 1;
CREATE SEQUENCE lid_seq START 1;
CREATE SEQUENCE tch_seq START 1;
CREATE SEQUENCE pay_seq START 1;

-- ================== CRM (markaz boshqaruvi) ==================

CREATE TABLE leads (
    id               TEXT PRIMARY KEY DEFAULT ('LID-' || lpad(nextval('lid_seq')::text, 5, '0')),
    full_name        TEXT NOT NULL,
    phone            TEXT NOT NULL,
    source           TEXT NOT NULL DEFAULT 'boshqa' CHECK (source IN ('instagram','telegram','tavsiya','otib_ketgan','boshqa')),
    interested_level TEXT REFERENCES levels(code),
    status           TEXT NOT NULL DEFAULT 'yangi'
                     CHECK (status IN ('yangi','aloqa_qilindi','sinov_belgilandi','sinovga_keldi','yozildi','yoqotildi')),
    trial_date       DATE,
    assigned_to      TEXT,
    note             TEXT,
    created_at       DATE NOT NULL DEFAULT CURRENT_DATE,
    student_id       TEXT
);

CREATE TABLE students (
    id                 TEXT PRIMARY KEY DEFAULT ('STU-' || lpad(nextval('stu_seq')::text, 5, '0')),
    first_name         TEXT NOT NULL,
    last_name          TEXT NOT NULL,
    phone              TEXT NOT NULL,
    birth_date         DATE,
    parent_name        TEXT,
    parent_phone       TEXT,
    source             TEXT,
    status             TEXT NOT NULL DEFAULT 'faol'
                       CHECK (status IN ('faol','pauza','bitirgan','ketgan')),
    current_level_code TEXT REFERENCES levels(code),
    joined_at          DATE NOT NULL DEFAULT CURRENT_DATE,
    note               TEXT
);

CREATE TABLE teachers (
    id        TEXT PRIMARY KEY DEFAULT ('TCH-' || lpad(nextval('tch_seq')::text, 3, '0')),
    full_name TEXT NOT NULL,
    phone     TEXT NOT NULL,
    levels    TEXT NOT NULL DEFAULT '',
    hire_date DATE,
    status    TEXT NOT NULL DEFAULT 'faol' CHECK (status IN ('faol','tatil','ketgan')),
    note      TEXT
);

CREATE TABLE rooms (
    id       TEXT PRIMARY KEY,                -- XONA-1
    name     TEXT NOT NULL,
    capacity INT  NOT NULL DEFAULT 12
);

CREATE TABLE groups (
    id               TEXT PRIMARY KEY,        -- GRP-2609-BEG-01
    level_code       TEXT NOT NULL REFERENCES levels(code),
    teacher_id       TEXT NOT NULL REFERENCES teachers(id),
    room_id          TEXT REFERENCES rooms(id),
    days_pattern     TEXT NOT NULL CHECK (days_pattern IN ('DCJ','SPS')),
    start_time       TIME NOT NULL,
    start_date       DATE NOT NULL,
    end_date_planned DATE NOT NULL,
    status           TEXT NOT NULL DEFAULT 'rejada'
                     CHECK (status IN ('rejada','faol','imtihon','yakunlangan','bekor')),
    capacity         INT  NOT NULL DEFAULT 12,
    monthly_fee      NUMERIC(12,0) NOT NULL
);

CREATE TABLE enrollments (
    id            SERIAL PRIMARY KEY,
    student_id    TEXT NOT NULL REFERENCES students(id),
    group_id      TEXT NOT NULL REFERENCES groups(id),
    enrolled_at   DATE NOT NULL DEFAULT CURRENT_DATE,
    left_at       DATE,
    status        TEXT NOT NULL DEFAULT 'faol'
                  CHECK (status IN ('faol','yakunladi','kochirildi','tashlab_ketdi')),
    discount_pct  INT  NOT NULL DEFAULT 0,
    is_fast_track BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (student_id, group_id)
);

CREATE TABLE sessions (
    id                SERIAL PRIMARY KEY,
    group_id          TEXT NOT NULL REFERENCES groups(id),
    lesson_code       TEXT NOT NULL REFERENCES lessons(code),
    session_date      DATE NOT NULL,
    actual_teacher_id TEXT REFERENCES teachers(id),
    status            TEXT NOT NULL DEFAULT 'rejada'
                      CHECK (status IN ('rejada','otildi','bekor','kochirildi')),
    note              TEXT,
    UNIQUE (group_id, lesson_code)
);

CREATE TABLE attendance (
    id         SERIAL PRIMARY KEY,
    session_id INT  NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id),
    status     TEXT NOT NULL CHECK (status IN ('keldi','kechikdi','kelmadi','sababli')),
    note       TEXT,
    UNIQUE (session_id, student_id)
);

CREATE TABLE homework_results (
    id            SERIAL PRIMARY KEY,
    student_id    TEXT NOT NULL REFERENCES students(id),
    homework_code TEXT NOT NULL REFERENCES homework(code),
    group_id      TEXT NOT NULL REFERENCES groups(id),
    status        TEXT NOT NULL DEFAULT 'berildi'
                  CHECK (status IN ('berildi','topshirdi','tekshirildi','kech','bajarmadi')),
    submitted_at  TIMESTAMPTZ,
    score         INT,
    checked_by    TEXT REFERENCES teachers(id),
    UNIQUE (student_id, homework_code, group_id)
);

CREATE TABLE assessment_results (
    id              SERIAL PRIMARY KEY,
    student_id      TEXT NOT NULL REFERENCES students(id),
    group_id        TEXT NOT NULL REFERENCES groups(id),
    assessment_code TEXT NOT NULL REFERENCES assessments(code),
    taken_at        DATE NOT NULL DEFAULT CURRENT_DATE,
    score_pct       NUMERIC(5,1) NOT NULL,
    passed          BOOLEAN NOT NULL,
    attempt_no      INT NOT NULL DEFAULT 1,
    is_fast_track   BOOLEAN NOT NULL DEFAULT FALSE,
    next_action     TEXT CHECK (next_action IN ('otdi_keyingi','qayta_topshiradi','moslashuv_2_hafta')),
    note            TEXT
);

CREATE TABLE payments (
    id          TEXT PRIMARY KEY DEFAULT ('PAY-' || lpad(nextval('pay_seq')::text, 6, '0')),
    student_id  TEXT NOT NULL REFERENCES students(id),
    group_id    TEXT NOT NULL REFERENCES groups(id),
    period      TEXT NOT NULL,                -- '2026-09'
    amount_due  NUMERIC(12,0) NOT NULL,
    amount_paid NUMERIC(12,0) NOT NULL DEFAULT 0,
    paid_at     DATE,
    method      TEXT CHECK (method IN ('naqd','karta','click','payme','otkazma')),
    status      TEXT NOT NULL DEFAULT 'kutilmoqda'
                CHECK (status IN ('kutilmoqda','qisman','tolangan','muddati_otgan')),
    receipt_no  TEXT,
    received_by TEXT,
    UNIQUE (student_id, group_id, period)
);

CREATE TABLE rating_points (
    id         SERIAL PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id),
    group_id   TEXT NOT NULL REFERENCES groups(id),
    source     TEXT NOT NULL CHECK (source IN ('mini_test','uy_vazifasi','davomat','bonus')),
    points     INT  NOT NULL,
    ref_code   TEXT,
    awarded_at DATE NOT NULL DEFAULT CURRENT_DATE
);

-- ================== ILOVA (mobil ilova, keyingi bosqich) ==================

CREATE TABLE app_users (
    id            SERIAL PRIMARY KEY,
    auth_uid      UUID UNIQUE,                -- Supabase auth.users bilan bog'lanadi (ilova chiqqach)
    phone         TEXT NOT NULL UNIQUE,
    role          TEXT NOT NULL CHECK (role IN ('oquvchi','ota_ona','oqituvchi','admin')),
    student_id    TEXT REFERENCES students(id),
    teacher_id    TEXT REFERENCES teachers(id),
    fcm_token     TEXT,
    lang          TEXT NOT NULL DEFAULT 'uz' CHECK (lang IN ('uz','ru','en')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ
);

CREATE TABLE app_user_students (
    app_user_id INT  NOT NULL REFERENCES app_users(id),
    student_id  TEXT NOT NULL REFERENCES students(id),
    PRIMARY KEY (app_user_id, student_id)
);

CREATE TABLE notifications (
    id          SERIAL PRIMARY KEY,
    app_user_id INT  NOT NULL REFERENCES app_users(id),
    n_type      TEXT NOT NULL CHECK (n_type IN ('uy_vazifasi','tolov','test_natija','davomat','elon','boshqa')),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at     TIMESTAMPTZ
);

-- ================== INDEKSLAR ==================

CREATE INDEX idx_units_level      ON units(level_code);
CREATE INDEX idx_lessons_unit     ON lessons(unit_code);
CREATE INDEX idx_materials_lesson ON materials(lesson_code);
CREATE INDEX idx_vocab_unit       ON vocabulary(unit_code);
CREATE INDEX idx_homework_lesson  ON homework(lesson_code);
CREATE INDEX idx_assess_level     ON assessments(level_code);
CREATE INDEX idx_enroll_student   ON enrollments(student_id);
CREATE INDEX idx_enroll_group     ON enrollments(group_id);
CREATE INDEX idx_sessions_group   ON sessions(group_id, session_date);
CREATE INDEX idx_att_session      ON attendance(session_id);
CREATE INDEX idx_att_student      ON attendance(student_id);
CREATE INDEX idx_hwres_student    ON homework_results(student_id);
CREATE INDEX idx_assres_student   ON assessment_results(student_id);
CREATE INDEX idx_pay_student      ON payments(student_id, period);
CREATE INDEX idx_pay_status       ON payments(status);
CREATE INDEX idx_rating_student   ON rating_points(student_id, group_id);
CREATE INDEX idx_notif_user       ON notifications(app_user_id, read_at);

-- ================== FUNKSIYALAR ==================

-- Guruh IDsi: GRP-YYOO-BOSQICH-NN
CREATE OR REPLACE FUNCTION make_group_id(p_level TEXT, p_start DATE)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    prefix TEXT;
    n INT;
BEGIN
    prefix := 'GRP-' || to_char(p_start, 'YYMM') || '-' || p_level || '-';
    SELECT count(*) + 1 INTO n FROM groups WHERE id LIKE prefix || '%';
    RETURN prefix || lpad(n::text, 2, '0');
END;
$$;

-- Guruh uchun 36 ta dars sessiyasini avtomatik yaratish
-- (12 unit x 3 dars, zaxira mavzularsiz, DCJ/SPS kunlari bo'yicha)
CREATE OR REPLACE FUNCTION generate_sessions(p_group_id TEXT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    g    groups%ROWTYPE;
    l    RECORD;
    d    DATE;
    dows INT[];
    cnt  INT := 0;
BEGIN
    SELECT * INTO g FROM groups WHERE id = p_group_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Guruh topilmadi: %', p_group_id;
    END IF;
    IF g.days_pattern = 'DCJ' THEN
        dows := ARRAY[1,3,5];   -- Dushanba, Chorshanba, Juma
    ELSE
        dows := ARRAY[2,4,6];   -- Seshanba, Payshanba, Shanba
    END IF;
    d := g.start_date;
    WHILE NOT (EXTRACT(ISODOW FROM d)::int = ANY(dows)) LOOP
        d := d + 1;
    END LOOP;
    FOR l IN
        SELECT le.code
        FROM lessons le
        JOIN units u ON u.code = le.unit_code
        WHERE u.level_code = g.level_code AND NOT u.is_reserve
        ORDER BY u.unit_no, le.lesson_no
    LOOP
        INSERT INTO sessions (group_id, lesson_code, session_date, status)
        VALUES (p_group_id, l.code, d, 'rejada')
        ON CONFLICT (group_id, lesson_code) DO NOTHING;
        cnt := cnt + 1;
        d := d + 1;
        WHILE NOT (EXTRACT(ISODOW FROM d)::int = ANY(dows)) LOOP
            d := d + 1;
        END LOOP;
    END LOOP;
    RETURN cnt;
END;
$$;

-- Berilgan oy uchun barcha faol a'zoliklarga to'lov yozuvlarini yaratish
CREATE OR REPLACE FUNCTION generate_monthly_payments(p_period TEXT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    cnt INT;
BEGIN
    INSERT INTO payments (student_id, group_id, period, amount_due, status)
    SELECT e.student_id,
           e.group_id,
           p_period,
           round(g.monthly_fee * (100 - e.discount_pct) / 100.0),
           'kutilmoqda'
    FROM enrollments e
    JOIN groups g ON g.id = e.group_id
    WHERE e.status = 'faol'
      AND g.status IN ('rejada','faol','imtihon')
    ON CONFLICT (student_id, group_id, period) DO NOTHING;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    RETURN cnt;
END;
$$;

-- To'lov qabul qilish (holatni avtomatik yangilaydi)
CREATE OR REPLACE FUNCTION receive_payment(p_payment_id TEXT, p_amount NUMERIC, p_method TEXT, p_received_by TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE payments
    SET amount_paid = amount_paid + p_amount,
        paid_at     = CURRENT_DATE,
        method      = p_method,
        received_by = COALESCE(p_received_by, received_by),
        status      = CASE
                        WHEN amount_paid + p_amount >= amount_due THEN 'tolangan'
                        WHEN amount_paid + p_amount > 0            THEN 'qisman'
                        ELSE status
                      END
    WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tolov topilmadi: %', p_payment_id;
    END IF;
END;
$$;

-- ================== VIEWLAR ==================

CREATE VIEW v_qarzdorlar WITH (security_invoker = true) AS
SELECT p.student_id,
       s.first_name || ' ' || s.last_name AS oquvchi,
       s.phone,
       p.group_id,
       p.period,
       p.amount_due - p.amount_paid AS qarz,
       p.status
FROM payments p
JOIN students s ON s.id = p.student_id
WHERE p.status IN ('kutilmoqda','qisman','muddati_otgan')
  AND p.amount_due > p.amount_paid;

CREATE VIEW v_guruh_jurnali WITH (security_invoker = true) AS
SELECT se.id,
       se.group_id,
       se.session_date,
       se.lesson_code,
       u.title       AS unit_sarlavha,
       u.grammar_topic,
       l.title       AS dars_sarlavha,
       l.lesson_type,
       se.status,
       se.actual_teacher_id
FROM sessions se
JOIN lessons l ON l.code = se.lesson_code
JOIN units u   ON u.code = l.unit_code;

CREATE VIEW v_oquvchi_progress WITH (security_invoker = true) AS
SELECT e.student_id,
       e.group_id,
       ROUND(100.0 * COUNT(*) FILTER (WHERE a.status IN ('keldi','kechikdi'))
             / NULLIF(COUNT(a.id), 0), 0)                    AS davomat_pct,
       (SELECT ROUND(AVG(ar.score_pct), 1)
          FROM assessment_results ar
         WHERE ar.student_id = e.student_id
           AND ar.group_id  = e.group_id)                    AS ortacha_test,
       (SELECT COALESCE(SUM(rp.points), 0)
          FROM rating_points rp
         WHERE rp.student_id = e.student_id
           AND rp.group_id  = e.group_id)                    AS reyting_ball
FROM enrollments e
LEFT JOIN attendance a ON a.student_id = e.student_id
LEFT JOIN sessions  se ON se.id = a.session_id AND se.group_id = e.group_id
GROUP BY e.student_id, e.group_id;

-- ================== XAVFSIZLIK (RLS) ==================
-- MVP: faqat tizimga kirgan xodimlar (authenticated) hamma narsani ko'radi/o'zgartiradi.
-- Mobil ilova chiqqanda o'quvchi/ota-ona uchun alohida cheklangan policylar qo'shiladi.

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'levels','units','lessons','materials','vocabulary','homework','assessments',
        'leads','students','teachers','rooms','groups','enrollments','sessions',
        'attendance','homework_results','assessment_results','payments','rating_points',
        'app_users','app_user_students','notifications'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format(
            'CREATE POLICY staff_all ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;
