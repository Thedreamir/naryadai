-- Stage: master issue form with "before" photo (audit #3). Data URLs, like closure photos.
alter table orders add column if not exists before_photos jsonb not null default '[]'::jsonb;
