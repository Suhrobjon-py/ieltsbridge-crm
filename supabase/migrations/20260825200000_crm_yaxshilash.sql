-- ============================================================
-- IELTSBridge CRM — yaxshilashlar (2026-08-25, 2-migratsiya)
-- 1) correct_payment    — noto'g'ri kiritilgan to'lovni to'g'rilash
-- 2) reschedule_sessions — guruh jadvali o'zgarganda rejadagi darslarni qayta sanalash
-- 3) v_ilova_ruxsat     — 3-dars qoidasi: ilovaga kirish ruxsatini avtomatik hisoblash
-- ============================================================

-- 1) To'lovni to'g'rilash: amount_paid ni MUTLAQ qiymatga o'rnatadi,
--    holatni qayta hisoblaydi. Ortiqcha yoki manfiy summa kiritib bo'lmaydi.
CREATE OR REPLACE FUNCTION correct_payment(p_payment_id TEXT, p_amount_paid NUMERIC, p_method TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    p payments%ROWTYPE;
BEGIN
    SELECT * INTO p FROM payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tolov topilmadi: %', p_payment_id;
    END IF;
    IF p_amount_paid < 0 OR p_amount_paid > p.amount_due THEN
        RAISE EXCEPTION 'Summa 0 dan % gacha bolishi kerak', p.amount_due;
    END IF;
    UPDATE payments
    SET amount_paid = p_amount_paid,
        method      = COALESCE(p_method, method),
        paid_at     = CASE WHEN p_amount_paid > 0 THEN COALESCE(paid_at, CURRENT_DATE) ELSE NULL END,
        status      = CASE
                        WHEN p_amount_paid >= amount_due THEN 'tolangan'
                        WHEN p_amount_paid > 0           THEN 'qisman'
                        ELSE 'kutilmoqda'
                      END
    WHERE id = p_payment_id;
END;
$$;

-- 2) Guruh jadvali o'zgarganda (kunlar/boshlanish sanasi) REJADAGI darslarni
--    qayta sanalash. O'tilgan darslar tarix sifatida joyida qoladi;
--    rejadagilar oxirgi o'tilgan darsdan keyingi mos kunlardan davom etadi.
CREATE OR REPLACE FUNCTION reschedule_sessions(p_group_id TEXT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    g    groups%ROWTYPE;
    r    RECORD;
    d    DATE;
    dows INT[];
    cnt  INT := 0;
BEGIN
    SELECT * INTO g FROM groups WHERE id = p_group_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Guruh topilmadi: %', p_group_id;
    END IF;
    IF g.days_pattern = 'DCJ' THEN
        dows := ARRAY[1,3,5];
    ELSE
        dows := ARRAY[2,4,6];
    END IF;
    SELECT COALESCE(max(session_date), g.start_date - 1)
      INTO d
      FROM sessions
     WHERE group_id = p_group_id AND status <> 'rejada';
    d := GREATEST(d, g.start_date - 1) + 1;
    WHILE NOT (EXTRACT(ISODOW FROM d)::int = ANY(dows)) LOOP
        d := d + 1;
    END LOOP;
    FOR r IN
        SELECT se.id
        FROM sessions se
        JOIN lessons le ON le.code = se.lesson_code
        JOIN units u    ON u.code = le.unit_code
        WHERE se.group_id = p_group_id AND se.status = 'rejada'
        ORDER BY u.unit_no, le.lesson_no
    LOOP
        UPDATE sessions SET session_date = d WHERE id = r.id;
        cnt := cnt + 1;
        d := d + 1;
        WHILE NOT (EXTRACT(ISODOW FROM d)::int = ANY(dows)) LOOP
            d := d + 1;
        END LOOP;
    END LOOP;
    RETURN cnt;
END;
$$;

-- 3) Ilova ruxsati (3-dars qoidasi):
--    - o'quvchi 3 tagacha darsga kelgan bo'lsa — ilova OCHIQ (sinov davri);
--    - 3 va undan ko'p darsga kelgan bo'lsa — joriy oy to'lovining kamida 49% i
--      to'langan bo'lishi shart, aks holda ilova BLOKLANADI (faqat to'lov oynasi).
--    Mobil ilova va CRM ikkalasi ham shu view'dan o'qiydi — mantiq bitta joyda.
CREATE OR REPLACE VIEW v_ilova_ruxsat WITH (security_invoker = true) AS
SELECT x.student_id,
       x.group_id,
       x.kelgan_darslar,
       x.tolov_foizi,
       (x.kelgan_darslar < 3 OR x.tolov_foizi >= 49) AS ilova_ochiq
FROM (
    SELECT e.student_id,
           e.group_id,
           (SELECT count(*)
              FROM attendance a
              JOIN sessions s ON s.id = a.session_id
             WHERE a.student_id = e.student_id
               AND s.group_id  = e.group_id
               AND a.status IN ('keldi','kechikdi')) AS kelgan_darslar,
           COALESCE((SELECT round(100.0 * p.amount_paid / NULLIF(p.amount_due, 0))
                       FROM payments p
                      WHERE p.student_id = e.student_id
                        AND p.group_id  = e.group_id
                        AND p.period    = to_char(CURRENT_DATE, 'YYYY-MM')), 0) AS tolov_foizi
    FROM enrollments e
    WHERE e.status = 'faol'
) x;
