-- Bucket público para imagens de campanha (foto enviada junto com a mensagem).
-- O worker de campanhas envia a URL pública via Evolution /message/sendMedia.
insert into storage.buckets (id, name, public)
values ('campaign-media', 'campaign-media', true)
on conflict (id) do nothing;

-- Usuários autenticados podem subir imagens nesse bucket (upload feito no navegador).
drop policy if exists "campaign_media_insert" on storage.objects;
create policy "campaign_media_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'campaign-media');
