-- Preserve corporate EHS records when an individual auth account is deleted.
-- User references become NULL; the business record itself remains available to the Werk.

alter table public.app_records alter column owner_user_id drop not null;
alter table public.app_records drop constraint if exists app_records_owner_user_id_fkey;
alter table public.app_records add constraint app_records_owner_user_id_fkey foreign key (owner_user_id) references auth.users(id) on delete set null;

alter table public.document_events drop constraint if exists document_events_actor_user_id_fkey;
alter table public.document_events add constraint document_events_actor_user_id_fkey foreign key (actor_user_id) references auth.users(id) on delete set null;

alter table public.document_versions alter column created_by drop not null;
alter table public.document_versions drop constraint if exists document_versions_created_by_fkey;
alter table public.document_versions add constraint document_versions_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.documents alter column creator_user_id drop not null;
alter table public.documents drop constraint if exists documents_creator_user_id_fkey;
alter table public.documents add constraint documents_creator_user_id_fkey foreign key (creator_user_id) references auth.users(id) on delete set null;
alter table public.documents drop constraint if exists documents_document_owner_fkey;
alter table public.documents add constraint documents_document_owner_fkey foreign key (document_owner) references auth.users(id) on delete set null;
alter table public.documents drop constraint if exists documents_reviewer_user_id_fkey;
alter table public.documents add constraint documents_reviewer_user_id_fkey foreign key (reviewer_user_id) references auth.users(id) on delete set null;
alter table public.documents drop constraint if exists documents_approver_user_id_fkey;
alter table public.documents add constraint documents_approver_user_id_fkey foreign key (approver_user_id) references auth.users(id) on delete set null;

alter table public.hazardous_substances alter column created_by drop not null;
alter table public.hazardous_substances alter column updated_by drop not null;
alter table public.hazardous_substances drop constraint if exists hazardous_substances_created_by_fkey;
alter table public.hazardous_substances add constraint hazardous_substances_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.hazardous_substances drop constraint if exists hazardous_substances_updated_by_fkey;
alter table public.hazardous_substances add constraint hazardous_substances_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;

alter table public.operating_instructions alter column created_by drop not null;
alter table public.operating_instructions alter column updated_by drop not null;
alter table public.operating_instructions drop constraint if exists operating_instructions_created_by_fkey;
alter table public.operating_instructions add constraint operating_instructions_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.operating_instructions drop constraint if exists operating_instructions_updated_by_fkey;
alter table public.operating_instructions add constraint operating_instructions_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;
