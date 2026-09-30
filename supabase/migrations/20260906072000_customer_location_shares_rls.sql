begin;

-- The application uses the server service-role client after its own auth and
-- admin checks. Keep an explicit deny policy for browser roles so the table
-- remains private while Supabase's RLS advisor can verify the intent.
create policy customer_location_shares_no_browser_read
  on public.customer_location_shares
  for select to anon, authenticated
  using (false);

create policy customer_location_shares_no_browser_write
  on public.customer_location_shares
  for all to anon, authenticated
  using (false)
  with check (false);

commit;
