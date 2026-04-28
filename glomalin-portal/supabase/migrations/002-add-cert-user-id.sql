-- Add cert_user_id to map Supabase profiles to organic-cert Prisma User IDs.
-- Used by mobile API gateway to inject operatorId into field operation POSTs.
alter table profiles add column cert_user_id text;
