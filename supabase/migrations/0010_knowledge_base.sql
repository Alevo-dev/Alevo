-- ─────────────────────────────────────────────────────────────────────────
-- 0010 — Knowledge base: pgvector-backed docs + chunks for grounded replies.
--
-- The Qualifier retrieves the most relevant chunks for an org and injects them
-- into its prompt, so answers are grounded in the MSP's own material. Embeddings
-- are Voyage `voyage-3.5-lite` (1024-dim). Tenant-isolated.
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists vector;

create type public.kb_source_type as enum ('text', 'url', 'pdf');
create type public.kb_doc_status  as enum ('pending', 'processing', 'ready', 'failed');

create table public.kb_documents (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  title       text not null,
  source_type public.kb_source_type not null,
  -- url | R2 object key | the pasted text itself (depending on source_type).
  source_ref  text,
  status      public.kb_doc_status not null default 'pending',
  error       text,
  chunk_count integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index kb_documents_org_id_idx on public.kb_documents (org_id);

create table public.kb_chunks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.kb_documents (id) on delete cascade,
  chunk_index integer not null,
  content     text not null,
  embedding   vector(1024),
  created_at  timestamptz not null default now()
);
create index kb_chunks_org_id_idx on public.kb_chunks (org_id);
create index kb_chunks_document_id_idx on public.kb_chunks (document_id);
-- Approximate-nearest-neighbour over cosine distance (Voyage → cosine).
create index kb_chunks_embedding_idx on public.kb_chunks
  using hnsw (embedding vector_cosine_ops);

-- ── Row-level security (tenant isolation) ─────────────────────────────────────
alter table public.kb_documents enable row level security;
create policy kb_documents_tenant on public.kb_documents for all
  using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()))
  with check (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));

alter table public.kb_chunks enable row level security;
create policy kb_chunks_tenant on public.kb_chunks for all
  using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()))
  with check (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));

grant select, insert, update, delete on public.kb_documents, public.kb_chunks to authenticated;
