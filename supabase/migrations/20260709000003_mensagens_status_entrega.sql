-- Status de entrega/leitura das mensagens enviadas (✓ enviado, ✓✓ entregue, ✓✓ azul lido).
-- Atualizado pelo evento MESSAGES_UPDATE da Evolution (webhook).
alter table public.mensagens add column if not exists status_entrega text;
