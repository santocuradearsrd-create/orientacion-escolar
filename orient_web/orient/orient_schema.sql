-- ============================================================
-- SISTEMA DE ORIENTACIÓN ESCOLAR — MIGRACIÓN SUPABASE
-- Ejecutar completo en SQL Editor de Supabase
-- Prefijo: orient_  (no colisiona con otros sistemas)
-- ============================================================

-- ── TABLAS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orient_usuarios (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT    NOT NULL,
  usuario         TEXT    UNIQUE NOT NULL,
  pin_hash        TEXT    NOT NULL,
  rol             TEXT    NOT NULL CHECK (rol IN ('admin','direccion','coordinador','psicologia','supervisor')),
  area            TEXT    CHECK (area IN ('primaria_ciclo1','primaria_ciclo2','secundaria_ciclo1','secundaria_ciclo2','ambos')),
  areas_cobertura TEXT[]  NOT NULL DEFAULT '{}',
  activo          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orient_casos (
  id                        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  docente_nombre            TEXT    NOT NULL,
  docente_materia           TEXT    NOT NULL,
  docente_grado             TEXT    NOT NULL,
  docente_seccion           TEXT    NOT NULL,
  estudiante_id             UUID    REFERENCES estudiantes(id),
  estudiante_nombre_manual  TEXT,
  descripcion_situacion     TEXT    NOT NULL,
  acciones_tomadas          TEXT    NOT NULL,
  es_actitud_repetida       BOOLEAN NOT NULL DEFAULT false,
  veces_repetida            INTEGER NOT NULL DEFAULT 0,
  observaciones_adicionales TEXT,
  estado                    TEXT    NOT NULL DEFAULT 'abierto'
                            CHECK (estado IN ('abierto','en_proceso','cerrado')),
  nivel_caso                TEXT    NOT NULL CHECK (nivel_caso IN ('primaria','secundaria')),
  area                      TEXT    NOT NULL
                            CHECK (area IN ('primaria_ciclo1','primaria_ciclo2','secundaria_ciclo1','secundaria_ciclo2')),
  asignado_a                UUID    REFERENCES orient_usuarios(id),
  gravedad                  TEXT    CHECK (gravedad IN ('leve','moderado','grave','urgente')),
  resolucion                TEXT,
  acuerdos                  TEXT,
  proxima_cita              DATE,
  cerrado_por               UUID    REFERENCES orient_usuarios(id),
  cerrado_at                TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS orient_seguimiento (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id    UUID    NOT NULL REFERENCES orient_casos(id) ON DELETE CASCADE,
  usuario_id UUID    REFERENCES orient_usuarios(id),
  tipo       TEXT    NOT NULL,
  contenido  TEXT    NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE orient_usuarios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orient_casos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orient_seguimiento ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orient_usuarios' AND policyname='deny_direct') THEN
    CREATE POLICY deny_direct ON orient_usuarios FOR ALL USING (false) WITH CHECK (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orient_casos' AND policyname='deny_direct') THEN
    CREATE POLICY deny_direct ON orient_casos FOR ALL USING (false) WITH CHECK (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orient_seguimiento' AND policyname='deny_direct') THEN
    CREATE POLICY deny_direct ON orient_seguimiento FOR ALL USING (false) WITH CHECK (false);
  END IF;
END $$;

-- ── HELPER: CALCULAR ÁREA ────────────────────────────────────

CREATE OR REPLACE FUNCTION orient_calc_area(p_nivel TEXT, p_grado TEXT)
RETURNS TEXT AS $$
BEGIN
  IF p_grado IN ('1ro','2do','3ro') THEN RETURN p_nivel || '_ciclo1';
  ELSE RETURN p_nivel || '_ciclo2';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── LOGIN ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION orient_login(p_usuario TEXT, p_pin_hash TEXT)
RETURNS JSON AS $$
DECLARE v orient_usuarios%ROWTYPE;
BEGIN
  SELECT * INTO v FROM orient_usuarios
  WHERE usuario = p_usuario AND pin_hash = p_pin_hash AND activo = true;
  IF NOT FOUND THEN
    RETURN json_build_object('error','Usuario o PIN incorrecto');
  END IF;
  RETURN json_build_object(
    'id',              v.id,
    'nombre',          v.nombre,
    'rol',             v.rol,
    'area',            v.area,
    'areas_cobertura', v.areas_cobertura
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── PSICÓLOGOS DISPONIBLES POR ÁREA ─────────────────────────
-- Incluye psicólogos con cobertura activa para esa área

CREATE OR REPLACE FUNCTION orient_get_psicologos_area(p_area TEXT)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.es_principal DESC, t.nombre), '[]'::json)
    FROM (
      SELECT
        id, nombre, area, areas_cobertura,
        (area = p_area) AS es_principal
      FROM orient_usuarios
      WHERE rol = 'psicologia'
        AND activo = true
        AND (area = p_area OR p_area = ANY(areas_cobertura))
    ) t
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── ENVIAR CASO (docente, sin auth) ─────────────────────────

CREATE OR REPLACE FUNCTION orient_enviar_caso(p_datos JSON)
RETURNS TABLE(id UUID) AS $$
DECLARE
  v_nivel    TEXT;
  v_grado    TEXT;
  v_area     TEXT;
  v_asignado UUID;
  v_nuevo_id UUID;
BEGIN
  v_nivel := p_datos->>'nivel_caso';
  v_grado := p_datos->>'docente_grado';
  v_area  := orient_calc_area(v_nivel, v_grado);

  -- AUTO-ASSIGN: buscar psicólogo principal del área primero,
  -- si no hay, buscar quién tiene cobertura activa del área.
  -- Orden: principal > cobertura. Si hay varios de cobertura, el primero por nombre.
  SELECT u.id INTO v_asignado
  FROM orient_usuarios u
  WHERE u.rol = 'psicologia' AND u.activo = true
    AND (u.area = v_area OR v_area = ANY(u.areas_cobertura))
  ORDER BY
    CASE WHEN u.area = v_area THEN 0 ELSE 1 END, -- principal primero
    u.nombre
  LIMIT 1;

  INSERT INTO orient_casos (
    docente_nombre, docente_materia, docente_grado, docente_seccion,
    estudiante_id, estudiante_nombre_manual,
    descripcion_situacion, acciones_tomadas,
    es_actitud_repetida, veces_repetida, observaciones_adicionales,
    nivel_caso, area, estado, asignado_a
  ) VALUES (
    p_datos->>'docente_nombre',   p_datos->>'docente_materia',
    p_datos->>'docente_grado',    p_datos->>'docente_seccion',
    NULLIF(p_datos->>'estudiante_id','')::UUID,
    NULLIF(p_datos->>'estudiante_nombre_manual',''),
    p_datos->>'descripcion_situacion',
    NULLIF(p_datos->>'acciones_tomadas',''),
    COALESCE((p_datos->>'es_actitud_repetida')::boolean, false),
    COALESCE((p_datos->>'veces_repetida')::int, 0),
    NULLIF(p_datos->>'observaciones_adicionales',''),
    v_nivel, v_area, 'abierto', v_asignado
  )
  RETURNING orient_casos.id INTO v_nuevo_id;

  -- Registrar en seguimiento si se asignó automáticamente
  IF v_asignado IS NOT NULL THEN
    INSERT INTO orient_seguimiento (caso_id, usuario_id, tipo, contenido)
    SELECT v_nuevo_id, v_asignado, 'asignacion',
      'Caso asignado automáticamente al área ' || v_area;
  END IF;

  RETURN QUERY SELECT v_nuevo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── GET CASOS (filtrado por área del usuario) ────────────────

CREATE OR REPLACE FUNCTION orient_get_casos(p_pin_hash TEXT, p_estado TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_user   orient_usuarios%ROWTYPE;
  v_result JSON;
BEGIN
  SELECT * INTO v_user FROM orient_usuarios WHERE pin_hash = p_pin_hash AND activo = true;
  IF NOT FOUND THEN RETURN '[]'::json; END IF;

  SELECT json_agg(c ORDER BY c.created_at DESC) INTO v_result FROM (
    SELECT
      ca.*,
      e.nombre AS estudiante_nombre_bd,
      u.nombre AS asignado_nombre
    FROM orient_casos ca
    LEFT JOIN estudiantes     e ON ca.estudiante_id = e.id
    LEFT JOIN orient_usuarios u ON ca.asignado_a    = u.id
    WHERE (p_estado IS NULL OR ca.estado = p_estado)
    AND CASE v_user.rol
      WHEN 'admin' THEN true
      WHEN 'direccion' THEN
        CASE
          WHEN v_user.area IS NULL OR v_user.area = 'ambos' THEN true
          WHEN v_user.area LIKE 'primaria%'   THEN ca.nivel_caso = 'primaria'
          WHEN v_user.area LIKE 'secundaria%' THEN ca.nivel_caso = 'secundaria'
          ELSE false
        END
      WHEN 'psicologia' THEN
        ca.asignado_a = v_user.id
        OR ca.area = v_user.area
        OR ca.area = ANY(v_user.areas_cobertura)
      WHEN 'coordinador' THEN
        v_user.area IS NULL
        OR v_user.area = 'ambos'
        OR ca.area = v_user.area
        OR ca.area = ANY(v_user.areas_cobertura)
      WHEN 'supervisor' THEN
        v_user.area IS NULL
        OR v_user.area = 'ambos'
        OR ca.area = v_user.area
        OR ca.area = ANY(v_user.areas_cobertura)
      ELSE false
    END
  ) c;
  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── GET CASO DETALLE ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION orient_get_caso_detalle(p_pin_hash TEXT, p_caso_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user orient_usuarios%ROWTYPE;
  v_caso JSON;
  v_seg  JSON;
BEGIN
  SELECT * INTO v_user FROM orient_usuarios WHERE pin_hash = p_pin_hash AND activo = true;
  IF NOT FOUND THEN RETURN json_build_object('error','Sin permiso'); END IF;

  SELECT row_to_json(c) INTO v_caso FROM (
    SELECT ca.*,
      e.nombre AS estudiante_nombre_bd,
      u.nombre AS asignado_nombre
    FROM orient_casos ca
    LEFT JOIN estudiantes     e ON ca.estudiante_id = e.id
    LEFT JOIN orient_usuarios u ON ca.asignado_a    = u.id
    WHERE ca.id = p_caso_id
  ) c;

  SELECT json_agg(s ORDER BY s.created_at ASC) INTO v_seg FROM (
    SELECT cs.*, u.nombre AS usuario_nombre
    FROM orient_seguimiento cs
    LEFT JOIN orient_usuarios u ON cs.usuario_id = u.id
    WHERE cs.caso_id = p_caso_id
  ) s;

  RETURN json_build_object(
    'caso',        v_caso,
    'seguimiento', COALESCE(v_seg, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── AGREGAR OBSERVACIÓN ──────────────────────────────────────

CREATE OR REPLACE FUNCTION orient_agregar_observacion(
  p_usuario_id UUID,
  p_pin_hash   TEXT,
  p_caso_id    UUID,
  p_tipo       TEXT,
  p_contenido  TEXT
)
RETURNS JSON AS $$
DECLARE
  v_user   orient_usuarios%ROWTYPE;
  v_estado TEXT;
BEGIN
  SELECT * INTO v_user FROM orient_usuarios
  WHERE id = p_usuario_id AND pin_hash = p_pin_hash AND activo = true;
  IF NOT FOUND THEN RETURN json_build_object('error','Sin permiso'); END IF;

  IF p_tipo = 'gravedad' AND v_user.rol NOT IN ('psicologia','admin') THEN
    RETURN json_build_object('error','Solo psicología puede asignar gravedad');
  END IF;

  SELECT estado INTO v_estado FROM orient_casos WHERE id = p_caso_id;
  IF v_estado = 'abierto' THEN
    UPDATE orient_casos SET estado = 'en_proceso' WHERE id = p_caso_id;
  END IF;

  IF p_tipo = 'gravedad' THEN
    UPDATE orient_casos SET gravedad = p_contenido WHERE id = p_caso_id;
  END IF;
  IF p_tipo = 'cita' THEN
    UPDATE orient_casos SET proxima_cita = p_contenido::DATE WHERE id = p_caso_id;
  END IF;

  INSERT INTO orient_seguimiento (caso_id, usuario_id, tipo, contenido)
  VALUES (p_caso_id, v_user.id, p_tipo, p_contenido);

  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── ASIGNAR / REASIGNAR CASO ─────────────────────────────────

CREATE OR REPLACE FUNCTION orient_asignar_caso(
  p_pin_hash   TEXT,
  p_caso_id    UUID,
  p_asignado_a UUID,
  p_nota       TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_user     orient_usuarios%ROWTYPE;
  v_asignado orient_usuarios%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM orient_usuarios
  WHERE pin_hash = p_pin_hash AND activo = true
    AND rol IN ('admin','coordinador','psicologia');
  IF NOT FOUND THEN RETURN json_build_object('error','Sin permiso'); END IF;

  SELECT * INTO v_asignado FROM orient_usuarios WHERE id = p_asignado_a;

  UPDATE orient_casos
  SET asignado_a = p_asignado_a, estado = 'en_proceso'
  WHERE id = p_caso_id;

  INSERT INTO orient_seguimiento (caso_id, usuario_id, tipo, contenido)
  VALUES (p_caso_id, v_user.id, 'reasignacion',
    COALESCE(p_nota, 'Reasignado a ' || v_asignado.nombre));

  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── CERRAR CASO ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION orient_cerrar_caso(
  p_pin_hash     TEXT,
  p_caso_id      UUID,
  p_resolucion   TEXT,
  p_acuerdos     TEXT DEFAULT NULL,
  p_proxima_cita DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE v_user orient_usuarios%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM orient_usuarios
  WHERE pin_hash = p_pin_hash AND activo = true
    AND rol IN ('psicologia','admin');
  IF NOT FOUND THEN
    RETURN json_build_object('error','Solo psicología puede cerrar casos');
  END IF;

  UPDATE orient_casos SET
    estado       = 'cerrado',
    resolucion   = p_resolucion,
    acuerdos     = p_acuerdos,
    proxima_cita = p_proxima_cita,
    cerrado_por  = v_user.id,
    cerrado_at   = now()
  WHERE id = p_caso_id;

  INSERT INTO orient_seguimiento (caso_id, usuario_id, tipo, contenido)
  VALUES (p_caso_id, v_user.id, 'cierre',
    'Caso cerrado. Resolución: ' || p_resolucion);

  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── ADMIN: GET USUARIOS ──────────────────────────────────────

CREATE OR REPLACE FUNCTION orient_get_usuarios(p_pin_hash TEXT)
RETURNS JSON AS $$
DECLARE v_admin orient_usuarios%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM orient_usuarios
  WHERE pin_hash = p_pin_hash AND rol = 'admin' AND activo = true;
  IF NOT FOUND THEN RETURN json_build_object('error','Sin permiso'); END IF;

  RETURN (
    SELECT COALESCE(json_agg(row_to_json(u) ORDER BY u.rol, u.nombre), '[]'::json)
    FROM orient_usuarios u
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── ADMIN: UPSERT USUARIO ────────────────────────────────────

CREATE OR REPLACE FUNCTION orient_upsert_usuario(
  p_pin_hash TEXT,
  p_id       UUID DEFAULT NULL,
  p_datos    JSON DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_admin orient_usuarios%ROWTYPE;
  v_nuevo UUID;
BEGIN
  SELECT * INTO v_admin FROM orient_usuarios
  WHERE pin_hash = p_pin_hash AND rol = 'admin' AND activo = true;
  IF NOT FOUND THEN RETURN json_build_object('error','Sin permiso'); END IF;

  IF p_id IS NOT NULL THEN
    UPDATE orient_usuarios SET
      nombre          = COALESCE(p_datos->>'nombre',          nombre),
      usuario         = COALESCE(p_datos->>'usuario',         usuario),
      rol             = COALESCE(p_datos->>'rol',             rol),
      area            = COALESCE(NULLIF(p_datos->>'area',''),  area),
      areas_cobertura = CASE
        WHEN p_datos->'areas_cobertura' IS NOT NULL
        THEN (SELECT COALESCE(array_agg(v), '{}') FROM json_array_elements_text(p_datos->'areas_cobertura') v)
        ELSE areas_cobertura END,
      activo          = COALESCE((p_datos->>'activo')::boolean, activo),
      pin_hash        = CASE
        WHEN p_datos->>'pin_hash' IS NOT NULL AND p_datos->>'pin_hash' != ''
        THEN p_datos->>'pin_hash' ELSE pin_hash END,
      updated_at      = now()
    WHERE id = p_id;
    RETURN json_build_object('ok', true, 'id', p_id);
  ELSE
    IF p_datos->>'pin_hash' IS NULL OR p_datos->>'pin_hash' = '' THEN
      RETURN json_build_object('error','PIN requerido para nuevo usuario');
    END IF;
    INSERT INTO orient_usuarios (nombre, usuario, pin_hash, rol, area, areas_cobertura, activo)
    VALUES (
      p_datos->>'nombre',
      p_datos->>'usuario',
      p_datos->>'pin_hash',
      p_datos->>'rol',
      NULLIF(p_datos->>'area',''),
      COALESCE(
        (SELECT array_agg(v) FROM json_array_elements_text(COALESCE(p_datos->'areas_cobertura','[]'::json)) v),
        '{}'
      ),
      COALESCE((p_datos->>'activo')::boolean, true)
    ) RETURNING id INTO v_nuevo;
    RETURN json_build_object('ok', true, 'id', v_nuevo);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── ADMIN/DIRECCIÓN: SET COBERTURA ───────────────────────────
-- Admin y Dirección pueden activar cobertura de área

CREATE OR REPLACE FUNCTION orient_set_cobertura(
  p_pin_hash   TEXT,
  p_usuario_id UUID,
  p_areas      TEXT[]
)
RETURNS JSON AS $$
DECLARE v_admin orient_usuarios%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM orient_usuarios
  WHERE pin_hash = p_pin_hash AND rol IN ('admin','direccion') AND activo = true;
  IF NOT FOUND THEN RETURN json_build_object('error','Sin permiso'); END IF;

  UPDATE orient_usuarios
  SET areas_cobertura = COALESCE(p_areas, '{}'), updated_at = now()
  WHERE id = p_usuario_id;

  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── ADMIN: IMPORTAR ESTUDIANTES ──────────────────────────────

CREATE OR REPLACE FUNCTION orient_upsert_estudiantes(p_pin_hash TEXT, p_filas JSON)
RETURNS JSON AS $$
DECLARE
  v_admin orient_usuarios%ROWTYPE;
  v_fila  JSON;
BEGIN
  SELECT * INTO v_admin FROM orient_usuarios
  WHERE pin_hash = p_pin_hash AND rol = 'admin' AND activo = true;
  IF NOT FOUND THEN RETURN json_build_object('error','Sin permiso'); END IF;

  FOR v_fila IN SELECT * FROM json_array_elements(p_filas) LOOP
    INSERT INTO estudiantes (nombre, grado, seccion, numero_orden)
    VALUES (
      v_fila->>'nombre', v_fila->>'grado',
      v_fila->>'seccion', (v_fila->>'numero_orden')::int
    )
    ON CONFLICT (grado, seccion, numero_orden)
    DO UPDATE SET nombre = EXCLUDED.nombre, activo = true;
  END LOOP;
  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── ADMIN: GESTIÓN AÑO ESCOLAR ───────────────────────────────

CREATE OR REPLACE FUNCTION orient_gestion_estudiantes(
  p_pin_hash  TEXT,
  p_accion    TEXT,
  p_grado     TEXT  DEFAULT NULL,
  p_seccion   TEXT  DEFAULT NULL,
  p_grado_dest TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE v_admin orient_usuarios%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM orient_usuarios
  WHERE pin_hash = p_pin_hash AND rol = 'admin' AND activo = true;
  IF NOT FOUND THEN RETURN json_build_object('error','Sin permiso'); END IF;

  IF p_accion = 'desactivar_grado' THEN
    IF p_seccion IS NOT NULL AND p_seccion != '' THEN
      UPDATE estudiantes SET activo = false WHERE grado = p_grado AND seccion = p_seccion;
    ELSE
      UPDATE estudiantes SET activo = false WHERE grado = p_grado;
    END IF;
  ELSIF p_accion = 'promover' THEN
    IF p_grado = p_grado_dest THEN
      RETURN json_build_object('error','Origen y destino no pueden ser iguales');
    END IF;
    UPDATE estudiantes SET grado = p_grado_dest WHERE grado = p_grado AND activo = true;
  ELSIF p_accion = 'limpiar_todos' THEN
    UPDATE estudiantes SET activo = false WHERE activo = true;
  ELSE
    RETURN json_build_object('error','Acción no reconocida');
  END IF;

  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── TABLA COMPARTIDA: ESTUDIANTES ──────────────────────────
-- Si ya existe en el proyecto (sistema de exámenes), no la sobreescribe.
CREATE TABLE IF NOT EXISTS estudiantes (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT    NOT NULL,
  grado         TEXT    NOT NULL,
  seccion       TEXT    NOT NULL,
  numero_orden  INTEGER NOT NULL DEFAULT 0,
  activo        BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (grado, seccion, numero_orden)
);

-- RPC pública para leer estudiantes activos (evita problemas de RLS)
CREATE OR REPLACE FUNCTION orient_get_estudiantes()
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(e) ORDER BY e.grado, e.seccion, e.numero_orden), '[]'::json)
    FROM (
      SELECT id, nombre, grado, seccion, numero_orden
      FROM   estudiantes
      WHERE  activo = true
    ) e
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
