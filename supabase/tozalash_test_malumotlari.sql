-- ============================================================
-- BIR MARTALIK TOZALASH (migratsiya EMAS!)
-- O'quvchi, o'qituvchi, guruh va ularga bog'liq BARCHA operatsion
-- yozuvlarni o'chiradi. KONTENT (bosqich/mavzu/dars/lug'at/material/
-- uy vazifasi/baholash) va XARAJATLAR saqlanadi.
-- ID hisoblagichlar 1 dan qayta boshlanadi (STU-00001, TCH-001...).
-- ============================================================

DELETE FROM attendance;
DELETE FROM homework_results;
DELETE FROM assessment_results;
DELETE FROM rating_points;
DELETE FROM payments;
DELETE FROM sessions;
DELETE FROM enrollments;
DELETE FROM app_user_students;
DELETE FROM notifications;
DELETE FROM app_users;
DELETE FROM teacher_salaries;
DELETE FROM groups;
DELETE FROM students;
DELETE FROM teachers;

-- lidlardagi o'chirilgan o'quvchiga havolalarni tozalash
UPDATE leads SET student_id = NULL WHERE student_id IS NOT NULL;

-- ID hisoblagichlarni qayta boshlash
ALTER SEQUENCE stu_seq RESTART WITH 1;
ALTER SEQUENCE tch_seq RESTART WITH 1;
ALTER SEQUENCE pay_seq RESTART WITH 1;
ALTER SEQUENCE enrollments_id_seq RESTART WITH 1;
ALTER SEQUENCE sessions_id_seq RESTART WITH 1;
ALTER SEQUENCE attendance_id_seq RESTART WITH 1;
ALTER SEQUENCE homework_results_id_seq RESTART WITH 1;
ALTER SEQUENCE assessment_results_id_seq RESTART WITH 1;
ALTER SEQUENCE rating_points_id_seq RESTART WITH 1;
ALTER SEQUENCE teacher_salaries_id_seq RESTART WITH 1;
ALTER SEQUENCE app_users_id_seq RESTART WITH 1;
ALTER SEQUENCE notifications_id_seq RESTART WITH 1;

-- Yakuniy hisobot: operatsion jadvallar 0, kontent joyida bo'lishi kerak
SELECT (SELECT count(*) FROM students)     AS oquvchilar,
       (SELECT count(*) FROM teachers)     AS oqituvchilar,
       (SELECT count(*) FROM groups)       AS guruhlar,
       (SELECT count(*) FROM sessions)     AS sessiyalar,
       (SELECT count(*) FROM payments)     AS tolovlar,
       (SELECT count(*) FROM enrollments)  AS azoliklar,
       (SELECT count(*) FROM units)        AS kontent_mavzular,
       (SELECT count(*) FROM vocabulary)   AS kontent_lugat,
       (SELECT count(*) FROM expenses)     AS xarajatlar;
