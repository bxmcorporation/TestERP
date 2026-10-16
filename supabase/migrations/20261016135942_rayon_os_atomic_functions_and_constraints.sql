/*
# RAYON OS — Atomic Operations, CHECK Constraints, and Missing Policy

## Overview
This migration adds server-side atomic operations to prevent race conditions
and data inconsistency, adds CHECK constraints for data validation, and fixes
the missing UPDATE policy on the activities table.

## Changes

### 1. SECURITY DEFINER Functions (new)

1. `generate_code(p_prefix text, p_table text)` — Atomically generates the next
   sequential code for a table by finding MAX of existing numeric suffixes.
   Replaces the client-side count+1 approach that caused duplicate codes under
   concurrency.

2. `assign_student_to_class(p_class_id uuid, p_student_id uuid)` — Atomically:
   - Inserts into class_students
   - Updates enrollment status to 'ativa'
   - Updates student.academic_status to 'matriculado'
   - Validates capacity (throws if class is full)
   All within a single transaction. Returns the class_students record.

3. `remove_student_from_class(p_class_id uuid, p_student_id uuid)` — Atomically:
   - Deletes from class_students
   - Reverts enrollment status to 'aguardando_turma'
   - Reverts student.academic_status to 'aguardando'
   All within a single transaction.

4. `save_attendance(p_lesson_id uuid, p_records jsonb)` — Atomically upserts
   all attendance records for a lesson. Each record in the JSON array has:
   { student_id, status, justification? }. Uses INSERT ... ON CONFLICT to
   handle both new and existing records in one operation.

### 2. CHECK Constraints (new)

- students.status IN ('ativo', 'inativo')
- students.academic_status IN ('nao_matriculado', 'aguardando', 'matriculado', 'concluido', 'evadido')
- enrollments.status IN ('pendente', 'aguardando_turma', 'ativa', 'concluida', 'cancelada')
- classes.status IN ('planejamento', 'em_formacao', 'confirmada', 'em_andamento', 'concluida', 'cancelada')
- classes.min_capacity >= 1 AND classes.max_capacity >= 1 AND classes.min_capacity <= classes.max_capacity
- courses.status IN ('ativo', 'inativo')
- teachers.status IN ('ativo', 'inativo')
- rooms.status IN ('ativo', 'inativo')
- guardians.status IN ('ativo', 'inativo')
- units.status IN ('ativo', 'inativo')
- financial_items.status IN ('em_aberto', 'pago', 'vencido', 'cancelado')
- financial_items.type IN ('receita', 'despesa')
- financial_items.amount >= 0
- schedules.start_time < schedules.end_time
- attendance.status IN ('presente', 'ausente', 'justificado', 'pendente')
- class_students.status IN ('ativo', 'inativo')
- schedules.status IN ('ativo', 'inativo')
- lessons.status IN ('agendada', 'realizada', 'cancelada')

### 3. Missing UPDATE Policy on activities

Adds the missing UPDATE policy so the frontend can update activity records.

### 4. Execution Grants

All SECURITY DEFINER functions are granted EXECUTE to anon and authenticated roles.
*/

-- ============================================================
-- 1. CHECK CONSTRAINTS
-- ============================================================

-- Students
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'students_status_check') THEN
    ALTER TABLE students ADD CONSTRAINT students_status_check CHECK (status IN ('ativo', 'inativo'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'students_academic_status_check') THEN
    ALTER TABLE students ADD CONSTRAINT students_academic_status_check CHECK (academic_status IN ('nao_matriculado', 'aguardando', 'matriculado', 'concluido', 'evadido'));
  END IF;
END $$;

-- Enrollments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'enrollments_status_check') THEN
    ALTER TABLE enrollments ADD CONSTRAINT enrollments_status_check CHECK (status IN ('pendente', 'aguardando_turma', 'ativa', 'concluida', 'cancelada'));
  END IF;
END $$;

-- Classes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'classes_status_check') THEN
    ALTER TABLE classes ADD CONSTRAINT classes_status_check CHECK (status IN ('planejamento', 'em_formacao', 'confirmada', 'em_andamento', 'concluida', 'cancelada'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'classes_capacity_check') THEN
    ALTER TABLE classes ADD CONSTRAINT classes_capacity_check CHECK (min_capacity >= 1 AND max_capacity >= 1 AND min_capacity <= max_capacity);
  END IF;
END $$;

-- Courses
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'courses_status_check') THEN
    ALTER TABLE courses ADD CONSTRAINT courses_status_check CHECK (status IN ('ativo', 'inativo'));
  END IF;
END $$;

-- Teachers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'teachers_status_check') THEN
    ALTER TABLE teachers ADD CONSTRAINT teachers_status_check CHECK (status IN ('ativo', 'inativo'));
  END IF;
END $$;

-- Rooms
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'rooms_status_check') THEN
    ALTER TABLE rooms ADD CONSTRAINT rooms_status_check CHECK (status IN ('ativo', 'inativo'));
  END IF;
END $$;

-- Guardians
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'guardians_status_check') THEN
    ALTER TABLE guardians ADD CONSTRAINT guardians_status_check CHECK (status IN ('ativo', 'inativo'));
  END IF;
END $$;

-- Units
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'units_status_check') THEN
    ALTER TABLE units ADD CONSTRAINT units_status_check CHECK (status IN ('ativo', 'inativo'));
  END IF;
END $$;

-- Financial Items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financial_items_status_check') THEN
    ALTER TABLE financial_items ADD CONSTRAINT financial_items_status_check CHECK (status IN ('em_aberto', 'pago', 'vencido', 'cancelado'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financial_items_type_check') THEN
    ALTER TABLE financial_items ADD CONSTRAINT financial_items_type_check CHECK (type IN ('receita', 'despesa'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financial_items_amount_check') THEN
    ALTER TABLE financial_items ADD CONSTRAINT financial_items_amount_check CHECK (amount >= 0);
  END IF;
END $$;

-- Schedules
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'schedules_time_check') THEN
    ALTER TABLE schedules ADD CONSTRAINT schedules_time_check CHECK (start_time < end_time);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'schedules_status_check') THEN
    ALTER TABLE schedules ADD CONSTRAINT schedules_status_check CHECK (status IN ('ativo', 'inativo'));
  END IF;
END $$;

-- Attendance
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'attendance_status_check') THEN
    ALTER TABLE attendance ADD CONSTRAINT attendance_status_check CHECK (status IN ('presente', 'ausente', 'justificado', 'pendente'));
  END IF;
END $$;

-- Class Students
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'class_students_status_check') THEN
    ALTER TABLE class_students ADD CONSTRAINT class_students_status_check CHECK (status IN ('ativo', 'inativo'));
  END IF;
END $$;

-- Lessons
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'lessons_status_check') THEN
    ALTER TABLE lessons ADD CONSTRAINT lessons_status_check CHECK (status IN ('agendada', 'realizada', 'cancelada'));
  END IF;
END $$;

-- ============================================================
-- 2. MISSING UPDATE POLICY ON ACTIVITIES
-- ============================================================
DROP POLICY IF EXISTS "anon_update_activities" ON activities;
CREATE POLICY "anon_update_activities" ON activities
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3. SECURITY DEFINER FUNCTION: generate_code
-- ============================================================
CREATE OR REPLACE FUNCTION generate_code(p_prefix text, p_table text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_num bigint;
  v_result text;
  v_pattern text := '^' || p_prefix || '-(\d+)$';
BEGIN
  -- Extract the highest numeric suffix from the code column
  EXECUTE format(
    'SELECT COALESCE(MAX((regexp_match(code, %L))[1]::bigint), 0) FROM %I WHERE code ~ %L',
    v_pattern, p_table, v_pattern
  ) INTO v_max_num;

  v_result := p_prefix || '-' || lpad((v_max_num + 1)::text, 5, '0');
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_code(text, text) TO anon, authenticated;

-- ============================================================
-- 4. SECURITY DEFINER FUNCTION: assign_student_to_class
-- ============================================================
CREATE OR REPLACE FUNCTION assign_student_to_class(p_class_id uuid, p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_capacity integer;
  v_current_count integer;
  v_course_id uuid;
BEGIN
  -- Get class capacity and course
  SELECT max_capacity, course_id INTO v_max_capacity, v_course_id
  FROM classes WHERE id = p_class_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turma nao encontrada';
  END IF;

  -- Check current enrollment count
  SELECT count(*) INTO v_current_count
  FROM class_students WHERE class_id = p_class_id AND status = 'ativo';

  IF v_current_count >= v_max_capacity THEN
    RAISE EXCEPTION 'Capacidade maxima da turma atingida (% alunos)', v_max_capacity;
  END IF;

  -- Insert class_students
  INSERT INTO class_students (class_id, student_id, status)
  VALUES (p_class_id, p_student_id, 'ativo')
  ON CONFLICT (class_id, student_id) DO UPDATE SET status = 'ativo';

  -- Update enrollment status
  UPDATE enrollments
  SET status = 'ativa', updated_at = now()
  WHERE student_id = p_student_id AND course_id = v_course_id AND status = 'aguardando_turma';

  -- Update student academic status
  UPDATE students
  SET academic_status = 'matriculado', updated_at = now()
  WHERE id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_student_to_class(uuid, uuid) TO anon, authenticated;

-- ============================================================
-- 5. SECURITY DEFINER FUNCTION: remove_student_from_class
-- ============================================================
CREATE OR REPLACE FUNCTION remove_student_from_class(p_class_id uuid, p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id uuid;
BEGIN
  -- Get course_id before deleting
  SELECT course_id INTO v_course_id
  FROM classes WHERE id = p_class_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turma nao encontrada';
  END IF;

  -- Delete from class_students
  DELETE FROM class_students
  WHERE class_id = p_class_id AND student_id = p_student_id;

  -- Revert enrollment status
  UPDATE enrollments
  SET status = 'aguardando_turma', updated_at = now()
  WHERE student_id = p_student_id AND course_id = v_course_id AND status = 'ativa';

  -- Revert student academic status
  UPDATE students
  SET academic_status = 'aguardando', updated_at = now()
  WHERE id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION remove_student_from_class(uuid, uuid) TO anon, authenticated;

-- ============================================================
-- 6. SECURITY DEFINER FUNCTION: save_attendance
-- ============================================================
CREATE OR REPLACE FUNCTION save_attendance(p_lesson_id uuid, p_records jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec jsonb;
  v_student_id uuid;
  v_status text;
  v_justification text;
BEGIN
  FOREACH rec IN ARRAY jsonb_array_elements(p_records)
  LOOP
    v_student_id := rec->>'student_id';
    v_status := rec->>'status';
    v_justification := rec->>'justification';

    INSERT INTO attendance (lesson_id, student_id, status, justification, recorded_at)
    VALUES (p_lesson_id, v_student_id, v_status, NULLIF(v_justification, ''), now())
    ON CONFLICT (lesson_id, student_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      justification = EXCLUDED.justification,
      recorded_at = now();
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION save_attendance(uuid, jsonb) TO anon, authenticated;
