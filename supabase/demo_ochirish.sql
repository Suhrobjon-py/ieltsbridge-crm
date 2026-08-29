-- DEMO ma'lumotlarni to'liq o'chirish (real ma'lumotlarga tegmaydi)
-- 9-seriya IDlar + demo guruhlarga bog'langan HAR QANDAY yozuvlar o'chiriladi
DELETE FROM lead_events WHERE lead_id LIKE 'LID-9%';
DELETE FROM trials WHERE lead_id LIKE 'LID-9%' OR group_id LIKE 'GRP-DEMO%';
DELETE FROM leads WHERE id LIKE 'LID-9%';
DELETE FROM attendance WHERE student_id LIKE 'STU-9%'
   OR session_id IN (SELECT id FROM sessions WHERE group_id LIKE 'GRP-DEMO%');
DELETE FROM payments WHERE id LIKE 'PAY-9%' OR group_id LIKE 'GRP-DEMO%';
DELETE FROM assessment_results WHERE student_id LIKE 'STU-9%' OR group_id LIKE 'GRP-DEMO%';
DELETE FROM homework_results WHERE student_id LIKE 'STU-9%' OR group_id LIKE 'GRP-DEMO%';
DELETE FROM rating_points WHERE student_id LIKE 'STU-9%' OR group_id LIKE 'GRP-DEMO%';
DELETE FROM enrollments WHERE student_id LIKE 'STU-9%' OR group_id LIKE 'GRP-DEMO%';
DELETE FROM sessions WHERE group_id LIKE 'GRP-DEMO%';
DELETE FROM teacher_salaries WHERE teacher_id LIKE 'TCH-9%';
DELETE FROM groups WHERE id LIKE 'GRP-DEMO%';
DELETE FROM students WHERE id LIKE 'STU-9%';
DELETE FROM teachers WHERE id LIKE 'TCH-9%';
DELETE FROM rooms WHERE id LIKE 'XONA-9%';
DELETE FROM expenses WHERE name LIKE '%(demo)%';
SELECT 'demo tozalandi' AS natija;
