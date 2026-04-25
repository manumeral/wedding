-- Allow organizers to remove mistaken or duplicate guest requests.
create policy "Admins can delete requests"
  on public.requests for delete
  to authenticated
  using (public.is_admin());
