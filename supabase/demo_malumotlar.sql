-- ============================================================
-- DEMO MA'LUMOTLAR (ixtiyoriy, migratsiya EMAS)
-- Barcha demo ID'lar 9-seriyada (TCH-901, GRP-DEMO-*, STU-9xxxx, LID-9xxxx)
-- — real ma'lumotlaringizga aralashmaydi.
-- O'chirish: supabase/demo_ochirish.sql
-- ============================================================

-- Xonalar va o'qituvchilar
INSERT INTO rooms (id, name, capacity) VALUES
  ('XONA-91', 'Demo 1-xona', 14), ('XONA-92', 'Demo 2-xona', 10)
ON CONFLICT DO NOTHING;

INSERT INTO teachers (id, full_name, phone, levels, degree, status) VALUES
  ('TCH-901', 'Dilnoza Rahimova (demo)', '+998 90 900 01 01', 'General', 'main', 'faol'),
  ('TCH-902', 'Jasur Toshmatov (demo)', '+998 90 900 02 02', 'IELTS', 'main', 'faol'),
  ('TCH-903', 'Malika Yusupova (demo)', '+998 90 900 03 03', 'General,IELTS', 'support', 'faol')
ON CONFLICT DO NOTHING;

-- Guruhlar: biri 3 hafta, biri 2 hafta oldin boshlangan
INSERT INTO groups (id, level_code, teacher_id, support_teacher_id, room_id, days_pattern, start_time, start_date, end_date_planned, status, capacity, monthly_fee) VALUES
  ('GRP-DEMO-BEG', 'BEG', 'TCH-901', 'TCH-903', 'XONA-91', 'DCJ', '18:00', CURRENT_DATE - 21, CURRENT_DATE + 70, 'faol', 12, 500000),
  ('GRP-DEMO-IEL', 'IEL', 'TCH-902', NULL,      'XONA-92', 'SPS', '16:00', CURRENT_DATE - 14, CURRENT_DATE + 77, 'faol', 10, 700000)
ON CONFLICT DO NOTHING;

SELECT generate_sessions('GRP-DEMO-BEG');
SELECT generate_sessions('GRP-DEMO-IEL');
UPDATE sessions SET status = 'otildi'
 WHERE group_id IN ('GRP-DEMO-BEG','GRP-DEMO-IEL') AND session_date < CURRENT_DATE;

-- O'quvchilar
INSERT INTO students (id, first_name, last_name, phone, parent_name, parent_phone, source, status, current_level_code, joined_at, churn_reason, churned_at, winback) VALUES
  ('STU-90001', 'Aziz',    'Karimov',   '+998 90 911 11 11', 'Karim aka',   '+998 90 911 11 12', 'instagram_ads',     'faol',   'BEG', CURRENT_DATE - 21, NULL, NULL, NULL),
  ('STU-90002', 'Madina',  'Usmonova',  '+998 90 922 22 22', 'Usmon aka',   '+998 90 922 22 23', 'tavsiya',           'faol',   'BEG', CURRENT_DATE - 21, NULL, NULL, NULL),
  ('STU-90003', 'Jasmina', 'Tohirova',  '+998 90 933 33 33', 'Tohir aka',   '+998 90 933 33 34', 'instagram_organic', 'faol',   'BEG', CURRENT_DATE - 20, NULL, NULL, NULL),
  ('STU-90004', 'Sardor',  'Aliyev',    '+998 90 944 44 44', 'Ali aka',     '+998 90 944 44 45', 'telegram',          'faol',   'BEG', CURRENT_DATE - 18, NULL, NULL, NULL),
  ('STU-90005', 'Kamola',  'Ergasheva', '+998 90 955 55 55', 'Ergash aka',  '+998 90 955 55 56', 'google_ads',        'faol',   'IEL', CURRENT_DATE - 14, NULL, NULL, NULL),
  ('STU-90006', 'Bobur',   'Nazarov',   '+998 90 966 66 66', 'Nazar aka',   '+998 90 966 66 67', 'website',           'faol',   'IEL', CURRENT_DATE - 14, NULL, NULL, NULL),
  ('STU-90007', 'Laylo',   'Sodiqova',  '+998 90 977 77 77', 'Sodiq aka',   '+998 90 977 77 78', 'instagram_ads',     'ketgan', 'BEG', CURRENT_DATE - 60, 'narx', CURRENT_DATE - 12, 'aloqa_qilindi'),
  ('STU-90008', 'Temur',   'G''aniyev', '+998 90 988 88 88', 'G''ani aka',  '+998 90 988 88 89', 'offline',           'ketgan', 'IEL', CURRENT_DATE - 55, 'vaqt_mos_emas', CURRENT_DATE - 8, 'qiziqdi')
ON CONFLICT DO NOTHING;

INSERT INTO enrollments (student_id, group_id, enrolled_at, status, discount_pct) VALUES
  ('STU-90001', 'GRP-DEMO-BEG', CURRENT_DATE - 21, 'faol', 0),
  ('STU-90002', 'GRP-DEMO-BEG', CURRENT_DATE - 21, 'faol', 10),
  ('STU-90003', 'GRP-DEMO-BEG', CURRENT_DATE - 20, 'faol', 0),
  ('STU-90004', 'GRP-DEMO-BEG', CURRENT_DATE - 18, 'faol', 0),
  ('STU-90005', 'GRP-DEMO-IEL', CURRENT_DATE - 14, 'faol', 0),
  ('STU-90006', 'GRP-DEMO-IEL', CURRENT_DATE - 14, 'faol', 0),
  ('STU-90007', 'GRP-DEMO-BEG', CURRENT_DATE - 60, 'tashlab_ketdi', 0)
ON CONFLICT DO NOTHING;

-- Davomat naqshlari (o'tilgan darslar bo'yicha):
-- STU-90001: hammasiga kelgan (score yuqori)
INSERT INTO attendance (session_id, student_id, status)
SELECT s.id, 'STU-90001', 'keldi' FROM sessions s
WHERE s.group_id = 'GRP-DEMO-BEG' AND s.status = 'otildi'
ON CONFLICT DO NOTHING;
-- STU-90002: bitta qoldirgan, qolganiga kelgan
INSERT INTO attendance (session_id, student_id, status)
SELECT s.id, 'STU-90002', CASE WHEN rn = 4 THEN 'kelmadi' ELSE 'keldi' END
FROM (SELECT id, row_number() OVER (ORDER BY session_date) rn FROM sessions
      WHERE group_id = 'GRP-DEMO-BEG' AND status = 'otildi') s
ON CONFLICT DO NOTHING;
-- STU-90003: OXIRGI 3 darsga ketma-ket kelmagan (ogohlantirish + past score)
INSERT INTO attendance (session_id, student_id, status)
SELECT s.id, 'STU-90003', CASE WHEN rn <= 3 THEN 'kelmadi' ELSE 'keldi' END
FROM (SELECT id, row_number() OVER (ORDER BY session_date DESC) rn FROM sessions
      WHERE group_id = 'GRP-DEMO-BEG' AND status = 'otildi') s
ON CONFLICT DO NOTHING;
-- STU-90004: har uchinchisini qoldiradi (e'tibor kerak)
INSERT INTO attendance (session_id, student_id, status)
SELECT s.id, 'STU-90004', CASE WHEN rn % 3 = 0 THEN 'kelmadi' ELSE 'keldi' END
FROM (SELECT id, row_number() OVER (ORDER BY session_date) rn FROM sessions
      WHERE group_id = 'GRP-DEMO-BEG' AND status = 'otildi') s
ON CONFLICT DO NOTHING;
-- IELTS guruhi: ikkalasi ham yaxshi qatnaydi
INSERT INTO attendance (session_id, student_id, status)
SELECT s.id, x.sid, 'keldi'
FROM sessions s CROSS JOIN (VALUES ('STU-90005'), ('STU-90006')) AS x(sid)
WHERE s.group_id = 'GRP-DEMO-IEL' AND s.status = 'otildi'
ON CONFLICT DO NOTHING;

-- To'lovlar: joriy oy
INSERT INTO payments (id, student_id, group_id, period, amount_due, amount_paid, paid_at, method, status) VALUES
  ('PAY-900001', 'STU-90001', 'GRP-DEMO-BEG', to_char(CURRENT_DATE, 'YYYY-MM'), 500000, 500000, CURRENT_DATE - 5, 'naqd',  'tolangan'),
  ('PAY-900002', 'STU-90002', 'GRP-DEMO-BEG', to_char(CURRENT_DATE, 'YYYY-MM'), 450000, 450000, CURRENT_DATE - 4, 'karta', 'tolangan'),
  ('PAY-900003', 'STU-90003', 'GRP-DEMO-BEG', to_char(CURRENT_DATE, 'YYYY-MM'), 500000, 0,      NULL,             NULL,    'muddati_otgan'),
  ('PAY-900004', 'STU-90004', 'GRP-DEMO-BEG', to_char(CURRENT_DATE, 'YYYY-MM'), 500000, 250000, CURRENT_DATE - 3, 'click', 'qisman'),
  ('PAY-900005', 'STU-90005', 'GRP-DEMO-IEL', to_char(CURRENT_DATE, 'YYYY-MM'), 700000, 700000, CURRENT_DATE - 6, 'naqd',  'tolangan'),
  ('PAY-900006', 'STU-90006', 'GRP-DEMO-IEL', to_char(CURRENT_DATE, 'YYYY-MM'), 700000, 700000, CURRENT_DATE - 6, 'payme', 'tolangan')
ON CONFLICT DO NOTHING;

-- Xarajatlar
INSERT INTO expenses (name, amount, spent_at) VALUES
  ('Ijara (demo)', 3000000, date_trunc('month', CURRENT_DATE)::date + 1),
  ('Internet (demo)', 200000, date_trunc('month', CURRENT_DATE)::date + 2),
  ('Marketing byudjeti (demo)', 1500000, date_trunc('month', CURRENT_DATE)::date + 3)
ON CONFLICT DO NOTHING;

-- ================= LIDLAR: pipeline bo'ylab 20 ta =================
INSERT INTO leads (id, first_name, last_name, phone, phone2, parent_name, source, subject, status, manager, priority, interest, last_contact_at, next_followup_at, birth_year, lost_reason, note, created_at) VALUES
  ('LID-90001', 'Diyor',    'Ahmedov',    '+998 90 100 01 01', NULL, 'Ahmed aka',    'instagram_ads',     'General', 'yangi',            'Aziza',  'yuqori', NULL,     NULL,                          NULL,              2010, NULL, NULL, CURRENT_DATE - 1),
  ('LID-90002', 'Sevinch',  'Qodirova',   '+998 90 100 02 02', NULL, 'Qodir aka',    'instagram_ads',     'IELTS',   'yangi',            NULL,     'orta',   NULL,     NULL,                          NULL,              2008, NULL, NULL, now() - interval '3 hours'),
  ('LID-90003', 'Islom',    'Berdiyev',   '+998 90 100 03 03', NULL, NULL,           'telegram',          'General', 'yangi',            'Bekzod', 'past',   NULL,     NULL,                          NULL,              2011, NULL, NULL, now() - interval '30 hours'),
  ('LID-90004', 'Nozima',   'Salimova',   '+998 90 100 04 04', NULL, 'Salim aka',    'google_ads',        'IELTS',   'birinchi_aloqa',   'Aziza',  'orta',   'orta',   now() - interval '2 days',     CURRENT_DATE - 1,  2007, NULL, NULL, CURRENT_DATE - 4),
  ('LID-90005', 'Akmal',    'Rustamov',   '+998 90 100 05 05', NULL, NULL,           'instagram_organic', 'General', 'birinchi_aloqa',   'Bekzod', 'orta',   'past',   now() - interval '26 hours',   CURRENT_DATE,      2009, NULL, NULL, CURRENT_DATE - 3),
  ('LID-90006', 'Zilola',   'Mirzayeva',  '+998 90 100 06 06', NULL, 'Mirza aka',    'facebook_ads',      'General', 'boglanib_bolmadi', 'Aziza',  'past',   NULL,     now() - interval '3 days',     CURRENT_DATE - 2,  2010, NULL, '3 marta qo''ng''iroq — javob yo''q', CURRENT_DATE - 6),
  ('LID-90007', 'Farrux',   'Olimov',     '+998 90 100 07 07', NULL, NULL,           'website',           'IELTS',   'boglanib_bolmadi', 'Bekzod', 'orta',   NULL,     now() - interval '4 days',     CURRENT_DATE - 3,  2006, NULL, NULL, CURRENT_DATE - 7),
  ('LID-90008', 'Gulnora',  'Xasanova',   '+998 90 100 08 08', '+998 91 100 08 09', 'Xasan aka', 'tavsiya', 'General', 'aloqa_ornatildi', 'Aziza', 'yuqori', 'yuqori', now() - interval '1 day',     CURRENT_DATE + 1,  2012, NULL, NULL, CURRENT_DATE - 5),
  ('LID-90009', 'Sanjar',   'Yo''ldoshev','+998 90 100 09 09', NULL, NULL,           'telefon',           'IELTS',   'aloqa_ornatildi',  'Bekzod', 'orta',   'orta',   now() - interval '2 days',     CURRENT_DATE,      2005, NULL, NULL, CURRENT_DATE - 8),
  ('LID-90010', 'Mohira',   'Davronova',  '+998 90 100 10 10', NULL, 'Davron aka',   'instagram_ads',     'General', 'qiziqish_bildirdi','Aziza',  'yuqori', 'yuqori', now() - interval '1 day',      CURRENT_DATE + 1,  2010, NULL, 'Narxni so''radi, guruh jadvalini yubordik', CURRENT_DATE - 6),
  ('LID-90011', 'Otabek',   'Sattorov',   '+998 90 100 11 11', NULL, NULL,           'instagram_organic', 'IELTS',   'qiziqish_bildirdi','Bekzod', 'orta',   'orta',   now() - interval '3 days',     CURRENT_DATE - 1,  2007, NULL, NULL, CURRENT_DATE - 9),
  ('LID-90012', 'Shahzoda', 'Karimova',   '+998 90 100 12 12', NULL, 'Karim aka',    'instagram_ads',     'General', 'sinovga_yozildi',  'Aziza',  'yuqori', 'yuqori', now() - interval '1 day',      CURRENT_DATE,      2011, NULL, NULL, CURRENT_DATE - 5),
  ('LID-90013', 'Javohir',  'Umarov',     '+998 90 100 13 13', NULL, NULL,           'google_ads',        'IELTS',   'sinovga_yozildi',  'Bekzod', 'orta',   'orta',   now() - interval '2 days',     CURRENT_DATE + 1,  2006, NULL, NULL, CURRENT_DATE - 7),
  ('LID-90014', 'Marjona',  'To''rayeva', '+998 90 100 14 14', NULL, 'To''ra aka',   'tavsiya',           'General', 'sinovga_keldi',    'Aziza',  'yuqori', 'yuqori', now() - interval '1 day',      CURRENT_DATE,      2010, NULL, 'Sinovdan mamnun, ota-onasi bilan gaplashadi', CURRENT_DATE - 8),
  ('LID-90015', 'Ulug''bek','Hamidov',    '+998 90 100 15 15', NULL, NULL,           'facebook_ads',      'IELTS',   'taklif_berildi',   'Bekzod', 'yuqori', 'yuqori', now() - interval '1 day',      CURRENT_DATE + 1,  2005, NULL, 'Taklif: IELTS guruh, 700 ming/oy', CURRENT_DATE - 10),
  ('LID-90016', 'Dilrabo',  'Ne''matova', '+998 90 100 16 16', NULL, 'Ne''mat aka',  'instagram_ads',     'General', 'qaror_kutilmoqda', 'Aziza',  'orta',   'orta',   now() - interval '2 days',     CURRENT_DATE - 1,  2009, NULL, 'Otasi bilan maslahatlashmoqda', CURRENT_DATE - 12),
  ('LID-90017', 'Bexruz',   'Sharipov',   '+998 90 100 17 17', NULL, NULL,           'instagram_ads',     'General', 'sotuv_yopildi',    'Aziza',  'yuqori', 'yuqori', now() - interval '5 days',     NULL,              2010, NULL, NULL, CURRENT_DATE - 15),
  ('LID-90018', 'Madina',   'Alimova',    '+998 90 100 18 18', NULL, 'Alim aka',     'tavsiya',           'IELTS',   'sotuv_yopildi',    'Bekzod', 'orta',   'yuqori', now() - interval '8 days',     NULL,              2006, NULL, NULL, CURRENT_DATE - 18),
  ('LID-90019', 'Sirojiddin','Mahmudov',  '+998 90 100 19 19', NULL, NULL,           'google_ads',        'General', 'rad_etdi',         'Aziza',  'past',   'past',   now() - interval '6 days',     NULL,              2008, 'narx_qimmat', 'Narx qimmat dedi, chegirma ham qiziqtirmadi', CURRENT_DATE - 14),
  ('LID-90020', 'Rayhona',  'Ismoilova',  '+998 90 100 20 20', NULL, 'Ismoil aka',   'facebook_ads',      'IELTS',   'rad_etdi',         'Bekzod', 'past',   'past',   now() - interval '9 days',     NULL,              2007, 'boshqa_markaz', 'Uyiga yaqin markazni tanladi', CURRENT_DATE - 16)
ON CONFLICT DO NOTHING;

-- Sinov darslari (trigger lid holatini o'zi sinxronlaydi — INSERT tartibi muhim emas)
INSERT INTO trials (lead_id, group_id, teacher_id, trial_date, trial_time, status, noshow_reason, feedback) VALUES
  ('LID-90012', 'GRP-DEMO-BEG', 'TCH-901', CURRENT_DATE,     '18:00', 'tasdiqlandi', NULL, NULL),
  ('LID-90013', 'GRP-DEMO-IEL', 'TCH-902', CURRENT_DATE + 1, '16:00', 'yozildi',     NULL, NULL),
  ('LID-90014', 'GRP-DEMO-BEG', 'TCH-901', CURRENT_DATE - 3, '18:00', 'muvaffaqiyatli', NULL, 'Darsda faol qatnashdi, saviyasi mos'),
  ('LID-90015', 'GRP-DEMO-IEL', 'TCH-902', CURRENT_DATE - 4, '16:00', 'keldi',       NULL, 'Yaxshi baza, band 5.5 atrofida'),
  ('LID-90016', 'GRP-DEMO-BEG', 'TCH-901', CURRENT_DATE - 5, '18:00', 'keldi',       NULL, NULL),
  ('LID-90017', 'GRP-DEMO-BEG', 'TCH-901', CURRENT_DATE - 9, '18:00', 'sotuvga_otkazildi', NULL, 'A''lo'),
  ('LID-90018', 'GRP-DEMO-IEL', 'TCH-902', CURRENT_DATE - 12,'16:00', 'sotuvga_otkazildi', NULL, NULL),
  ('LID-90019', 'GRP-DEMO-BEG', 'TCH-901', CURRENT_DATE - 8, '18:00', 'kelmadi', 'vaqt_mos_kelmadi', NULL),
  ('LID-90020', 'GRP-DEMO-IEL', 'TCH-902', CURRENT_DATE - 10,'16:00', 'kelmadi', 'vaqt_mos_kelmadi', NULL),
  ('LID-90011', 'GRP-DEMO-IEL', 'TCH-902', CURRENT_DATE + 2, '16:00', 'yozildi', NULL, NULL)
ON CONFLICT DO NOTHING;

-- Sotuv yopilgan lidlarni demo o'quvchilarga bog'lash
UPDATE leads SET student_id = 'STU-90001' WHERE id = 'LID-90017' AND student_id IS NULL;
UPDATE leads SET student_id = 'STU-90005' WHERE id = 'LID-90018' AND student_id IS NULL;

-- Qo'shimcha timeline yozuvlari (qo'ng'iroqlar tarixi)
INSERT INTO lead_events (lead_id, event_type, body, created_by, created_at) VALUES
  ('LID-90004', 'qongiroq', 'Qo''ng''iroq qilindi: IELTS haqida ma''lumot berildi', 'Aziza', now() - interval '2 days'),
  ('LID-90008', 'qongiroq', 'Qo''ng''iroq: ota-onasi bilan gaplashildi, qiziqish yuqori', 'Aziza', now() - interval '1 day'),
  ('LID-90010', 'sms',      'SMS: guruh jadvali va narxlar yuborildi', 'Aziza', now() - interval '1 day'),
  ('LID-90015', 'qongiroq', 'Taklif berildi: IELTS 700 ming/oy, javob kutilmoqda', 'Bekzod', now() - interval '1 day'),
  ('LID-90016', 'qongiroq', 'Follow-up 1: hali o''ylashyapti', 'Aziza', now() - interval '2 days')
ON CONFLICT DO NOTHING;

-- Yakuniy hisobot
SELECT (SELECT count(*) FROM leads    WHERE id LIKE 'LID-9%')  AS demo_lidlar,
       (SELECT count(*) FROM trials)                            AS sinovlar,
       (SELECT count(*) FROM students WHERE id LIKE 'STU-9%')  AS demo_oquvchilar,
       (SELECT count(*) FROM v_student_risk WHERE group_id LIKE 'GRP-DEMO%') AS risk_qatorlar,
       (SELECT count(*) FROM lead_events)                       AS timeline_yozuvlar;
