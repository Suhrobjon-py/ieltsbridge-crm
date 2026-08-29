-- ============================================================
-- IELTSBridge CRM — lidlar oqimi soddalashtirildi (2026-08-26, 6-migratsiya)
-- Yangi resepshn oqimi:
--   1) Resepshn lidni ro'yxatga oladi: ism, familiya, qanday topgani (manba),
--      fan (General/IELTS), telefon (+ ixtiyoriy 2-raqam)
--   2) Xodim telefon qiladi:
--      - "kelaman" -> guruhga biriktiriladi (o'quvchi yaratiladi) -> status 'yozildi'
--      - kelmasa   -> "Kelmadi" + MAJBURIY izoh -> status 'kelmaydi' (tarixda qoladi)
-- Bosqich (interested_level), sinov sanasi, mas'ul ustunlari olib tashlandi.
-- ============================================================

ALTER TABLE leads RENAME COLUMN full_name TO first_name;
ALTER TABLE leads ADD COLUMN last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN phone2 TEXT;
ALTER TABLE leads ADD COLUMN subject TEXT CHECK (subject IN ('General','IELTS'));

-- mavjud yozuvlarda ism-familiyani ajratish
UPDATE leads
SET last_name  = trim(substr(first_name, position(' ' in first_name) + 1)),
    first_name = split_part(first_name, ' ', 1)
WHERE position(' ' in first_name) > 0;

-- holatlarni soddalashtirish: yangi / yozildi / kelmaydi
ALTER TABLE leads DROP CONSTRAINT leads_status_check;
UPDATE leads SET status = CASE
    WHEN status IN ('aloqa_qilindi','sinov_belgilandi','sinovga_keldi') THEN 'yangi'
    WHEN status = 'yoqotildi' THEN 'kelmaydi'
    ELSE status
END;
ALTER TABLE leads ADD CONSTRAINT leads_status_check
    CHECK (status IN ('yangi','yozildi','kelmaydi'));

ALTER TABLE leads DROP COLUMN interested_level;
ALTER TABLE leads DROP COLUMN trial_date;
ALTER TABLE leads DROP COLUMN assigned_to;
