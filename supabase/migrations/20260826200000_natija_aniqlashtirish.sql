-- ============================================================
-- IELTSBridge CRM — imtihon qoidasi aniqlashtirildi (2026-08-26, 5-migratsiya)
-- Foydalanuvchi spetsifikatsiyasi:
--   1-urinish:  ball > 89        -> O'TDI (keyingi bosqich)
--               65 <= ball <= 89 -> 2-urinish huquqi
--               ball < 65        -> ikkinchi imkoniyat YO'Q, bosqich takrorlanadi
--   2-urinish:  ball > 79        -> O'TDI  (avvalgi versiyada >80 edi — tuzatildi)
--               aks holda        -> bosqich takrorlanadi
-- Natija kiritish CRM'da EMAS — o'qituvchi mobil ilovasida bo'ladi;
-- ilova assessment_results ga yozadi, hukmni shu trigger chiqaradi.
-- ============================================================

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
            IF NEW.score_pct > 79 THEN
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
