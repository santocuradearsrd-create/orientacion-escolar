export const SB_URL  = 'https://famdtakcyifspscmphiy.supabase.co';
export const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbWR0YWtjeWlmc3BzY21waGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTMzNDMsImV4cCI6MjA5MDg4OTM0M30.4bQVm39uwPP9W5BZrfyvmeaCdSy-Dx0yqDn2Ws8w0Fo';
export const sb = supabase.createClient(SB_URL, SB_ANON);

export const AREAS = {
  primaria_ciclo1:   'Primaria — 1er Ciclo (1ro–3ro)',
  primaria_ciclo2:   'Primaria — 2do Ciclo (4to–6to)',
  secundaria_ciclo1: 'Secundaria — 1er Ciclo (1ro–3ro)',
  secundaria_ciclo2: 'Secundaria — 2do Ciclo (4to–6to)',
  ambos:             'Todos los niveles',
};

export const GRADOS    = ['1ro','2do','3ro','4to','5to','6to'];
export const SECCIONES = ['A','B','C','D','E','F'];

export const ROLES_LABEL = {
  admin:       'Administrador',
  direccion:   'Dirección',
  coordinador: 'Coordinador/a',
  psicologia:  'Psicología',
  supervisor:  'Supervisor/a',
};
