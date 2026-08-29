-- ============================================================
-- IELTSBridge CRM — foydalanuvchi huquqlari tizimi (2026-08-28, 9-migratsiya)
-- Superadmin har foydalanuvchiga BO'LIMMA-BO'LIM huquq beradi:
--   (yo'q) / korish / tahrirlash / ochirish
-- Rollar: superadmin, admin, reseption, call_markaz, oqituvchi
-- O'qituvchi o'z guruhlariga bog'lanadi: faqat ularni ko'radi,
-- davomat va baho kirita oladi (huquq jadvalidan qat'i nazar).
-- can_manage_users = rol/foydalanuvchi yaratish huquqi (filial admini uchun).
-- Huquqlar BAZA darajasida (RLS) tekshiriladi — UI aylanib o'tib bo'lmaydi.
-- ============================================================

-- ---------- staff_roles kengaytmasi ----------
ALTER TABLE staff_roles ADD COLUMN full_name TEXT;
ALTER TABLE staff_roles ADD COLUMN teacher_id TEXT REFERENCES teachers(id);
ALTER TABLE staff_roles ADD COLUMN can_manage_users BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE staff_roles ADD COLUMN perms JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE staff_roles ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE staff_roles DROP CONSTRAINT staff_roles_role_check;
ALTER TABLE staff_roles ADD CONSTRAINT staff_roles_role_check
  CHECK (role IN ('superadmin','admin','reseption','call_markaz','oqituvchi'));

-- ---------- yordamchi funksiyalar (SECURITY DEFINER) ----------

CREATE OR REPLACE FUNCTION has_manage()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT is_superadmin() OR EXISTS (
        SELECT 1 FROM staff_roles
        WHERE lower(email) = lower(coalesce(auth.jwt()->>'email',''))
          AND can_manage_users
    );
$$;

-- Bo'lim bo'yicha huquq: korish <= tahrirlash <= ochirish
CREATE OR REPLACE FUNCTION has_perm(p_bolim TEXT, p_daraja TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT is_superadmin() OR EXISTS (
        SELECT 1 FROM staff_roles
        WHERE lower(email) = lower(coalesce(auth.jwt()->>'email',''))
          AND CASE p_daraja
                WHEN 'korish'     THEN coalesce(perms->>p_bolim,'') IN ('korish','tahrirlash','ochirish')
                WHEN 'tahrirlash' THEN coalesce(perms->>p_bolim,'') IN ('tahrirlash','ochirish')
                WHEN 'ochirish'   THEN coalesce(perms->>p_bolim,'') = 'ochirish'
                ELSE FALSE
              END
    );
$$;

-- O'qituvchi shu guruhga biriktirilganmi (asosiy yoki yordamchi)
CREATE OR REPLACE FUNCTION is_my_group(p_group_id TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM staff_roles sr
        JOIN groups g ON (g.teacher_id = sr.teacher_id OR g.support_teacher_id = sr.teacher_id)
        WHERE sr.teacher_id IS NOT NULL
          AND lower(sr.email) = lower(coalesce(auth.jwt()->>'email',''))
          AND g.id = p_group_id
    );
$$;

-- ---------- huquq ko'tarilishidan himoya ----------
-- can_manage_users bo'lgan admin superadmin yarata olmaydi,
-- boshqalarga rol boshqaruvini bera olmaydi, superadmin yozuviga tegolmaydi.
CREATE OR REPLACE FUNCTION staff_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- JWT yo'q = server/dashboard konteksti (postgres roli) — cheklov qo'llanmaydi
    IF auth.jwt() IS NULL THEN
        RETURN NEW;
    END IF;
    IF NOT is_superadmin() THEN
        IF NEW.role = 'superadmin' THEN
            RAISE EXCEPTION 'Superadmin yaratish faqat superadmin huquqi';
        END IF;
        IF NEW.can_manage_users THEN
            RAISE EXCEPTION 'Rol boshqaruvi huquqini faqat superadmin beradi';
        END IF;
        IF TG_OP = 'UPDATE' AND OLD.role = 'superadmin' THEN
            RAISE EXCEPTION 'Superadmin yozuvini ozgartirish mumkin emas';
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_staff_guard ON staff_roles;
CREATE TRIGGER trg_staff_guard BEFORE INSERT OR UPDATE ON staff_roles
FOR EACH ROW EXECUTE FUNCTION staff_guard();

-- ---------- RLS: barcha jadvallar bo'lim huquqlariga o'tadi ----------
-- KONTENT jadvallari: o'qish hammaga, yozish sozlamalar bo'limi orqali.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('leads','lidlar'), ('lead_events','lidlar'),
            ('trials','sinovlar'),
            ('students','oquvchilar'), ('enrollments','oquvchilar'),
            ('app_users','oquvchilar'), ('app_user_students','oquvchilar'), ('notifications','oquvchilar'),
            ('groups','guruhlar'), ('sessions','guruhlar'), ('attendance','guruhlar'),
            ('homework_results','guruhlar'), ('assessment_results','guruhlar'), ('rating_points','guruhlar'),
            ('rooms','xonalar'),
            ('teachers','oqituvchilar'),
            ('payments','tolovlar'),
            ('expenses','xarajatlar'),
            ('teacher_salaries','hisobotlar'),
            ('subjects','sozlamalar'), ('levels','sozlamalar'), ('units','sozlamalar'),
            ('lessons','sozlamalar'), ('materials','sozlamalar'), ('vocabulary','sozlamalar'),
            ('homework','sozlamalar'), ('assessments','sozlamalar')
        ) AS t(jadval, bolim)
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS staff_select ON %I', r.jadval);
        EXECUTE format('DROP POLICY IF EXISTS staff_insert ON %I', r.jadval);
        EXECUTE format('DROP POLICY IF EXISTS staff_update ON %I', r.jadval);
        EXECUTE format('DROP POLICY IF EXISTS super_delete ON %I', r.jadval);
        IF r.bolim = 'sozlamalar' THEN
            -- kontent va lug'atlar: o'qish barcha xodimlarga kerak
            EXECUTE format('CREATE POLICY staff_select ON %I FOR SELECT TO authenticated USING (true)', r.jadval);
        ELSE
            EXECUTE format('CREATE POLICY staff_select ON %I FOR SELECT TO authenticated USING (has_perm(%L, ''korish''))', r.jadval, r.bolim);
        END IF;
        EXECUTE format('CREATE POLICY staff_insert ON %I FOR INSERT TO authenticated WITH CHECK (has_perm(%L, ''tahrirlash''))', r.jadval, r.bolim);
        EXECUTE format('CREATE POLICY staff_update ON %I FOR UPDATE TO authenticated USING (has_perm(%L, ''tahrirlash'')) WITH CHECK (has_perm(%L, ''tahrirlash''))', r.jadval, r.bolim, r.bolim);
        EXECUTE format('CREATE POLICY super_delete ON %I FOR DELETE TO authenticated USING (has_perm(%L, ''ochirish''))', r.jadval, r.bolim);
    END LOOP;
END $$;

-- ---------- O'qituvchi uchun maxsus (o'z guruhlari) ----------

CREATE POLICY teacher_groups_sel ON groups FOR SELECT TO authenticated USING (is_my_group(id));
CREATE POLICY teacher_sessions_sel ON sessions FOR SELECT TO authenticated USING (is_my_group(group_id));
CREATE POLICY teacher_sessions_upd ON sessions FOR UPDATE TO authenticated
    USING (is_my_group(group_id)) WITH CHECK (is_my_group(group_id));
CREATE POLICY teacher_enroll_sel ON enrollments FOR SELECT TO authenticated USING (is_my_group(group_id));
CREATE POLICY teacher_students_sel ON students FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = students.id AND is_my_group(e.group_id)));
CREATE POLICY teacher_att_sel ON attendance FOR SELECT TO authenticated
    USING (is_my_group((SELECT s.group_id FROM sessions s WHERE s.id = attendance.session_id)));
CREATE POLICY teacher_att_ins ON attendance FOR INSERT TO authenticated
    WITH CHECK (is_my_group((SELECT s.group_id FROM sessions s WHERE s.id = attendance.session_id)));
CREATE POLICY teacher_att_upd ON attendance FOR UPDATE TO authenticated
    USING (is_my_group((SELECT s.group_id FROM sessions s WHERE s.id = attendance.session_id)))
    WITH CHECK (is_my_group((SELECT s.group_id FROM sessions s WHERE s.id = attendance.session_id)));
CREATE POLICY teacher_ar_sel ON assessment_results FOR SELECT TO authenticated USING (is_my_group(group_id));
CREATE POLICY teacher_ar_ins ON assessment_results FOR INSERT TO authenticated WITH CHECK (is_my_group(group_id));
CREATE POLICY teacher_hw_sel ON homework_results FOR SELECT TO authenticated USING (is_my_group(group_id));
CREATE POLICY teacher_hw_ins ON homework_results FOR INSERT TO authenticated WITH CHECK (is_my_group(group_id));
CREATE POLICY teacher_hw_upd ON homework_results FOR UPDATE TO authenticated
    USING (is_my_group(group_id)) WITH CHECK (is_my_group(group_id));
CREATE POLICY teacher_rating_ins ON rating_points FOR INSERT TO authenticated WITH CHECK (is_my_group(group_id));
CREATE POLICY teacher_rooms_sel ON rooms FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM groups g WHERE g.room_id = rooms.id AND is_my_group(g.id)));

-- ---------- staff_roles siyosatlari ----------
DROP POLICY IF EXISTS roles_select ON staff_roles;
DROP POLICY IF EXISTS roles_insert ON staff_roles;
DROP POLICY IF EXISTS roles_update ON staff_roles;
DROP POLICY IF EXISTS roles_delete ON staff_roles;
CREATE POLICY roles_select ON staff_roles FOR SELECT TO authenticated
    USING (has_manage() OR lower(email) = lower(coalesce(auth.jwt()->>'email','')));
CREATE POLICY roles_insert ON staff_roles FOR INSERT TO authenticated WITH CHECK (has_manage());
CREATE POLICY roles_update ON staff_roles FOR UPDATE TO authenticated
    USING (has_manage()) WITH CHECK (has_manage());
CREATE POLICY roles_delete ON staff_roles FOR DELETE TO authenticated USING (is_superadmin());
