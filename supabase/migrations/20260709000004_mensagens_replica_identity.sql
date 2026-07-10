-- Necessário para o Supabase Realtime entregar eventos de UPDATE filtrados por
-- uma coluna que não é a PK (company_id) — ex.: atualização do status_entrega
-- (ticks ✓/✓✓ ao vivo em Conversas, sem precisar dar F5).
alter table public.mensagens replica identity full;
