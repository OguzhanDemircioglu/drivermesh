alter table "filoLocal".companies enable row level security;
alter table "filoLocal".users enable row level security;
alter table "filoLocal".company_members enable row level security;
alter table "filoLocal".invitations enable row level security;
alter table "filoLocal".legal_consents enable row level security;

create policy companies_select on "filoLocal".companies
  for select to authenticated using (
    "filoLocal".is_employee()
    and (id = "filoLocal".current_company_id() or owner_id = auth.uid())
    and deleted_at is null
  );

create policy companies_insert on "filoLocal".companies
  for insert to authenticated with check (owner_id = auth.uid());

create policy companies_update on "filoLocal".companies
  for update to authenticated using (
    "filoLocal".is_patron() and id = "filoLocal".current_company_id()
  ) with check (
    "filoLocal".is_patron() and id = "filoLocal".current_company_id()
  );

create policy users_select_self on "filoLocal".users
  for select to authenticated using (id = auth.uid());

create policy users_select_company on "filoLocal".users
  for select to authenticated using (
    "filoLocal".is_employee()
    and exists (
      select 1 from "filoLocal".company_members cm
      where cm.user_id = "filoLocal".users.id
        and cm.company_id = "filoLocal".current_company_id()
        and cm.deleted_at is null
    )
  );

create policy users_update_self on "filoLocal".users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy users_insert_self on "filoLocal".users
  for insert to authenticated with check (id = auth.uid());

create policy members_select on "filoLocal".company_members
  for select to authenticated using (
    "filoLocal".is_employee()
    and company_id = "filoLocal".current_company_id()
    and deleted_at is null
  );

create policy members_insert_patron on "filoLocal".company_members
  for insert to authenticated with check (
    "filoLocal".is_patron() and company_id = "filoLocal".current_company_id()
  );

create policy members_update_patron on "filoLocal".company_members
  for update to authenticated
  using ("filoLocal".is_patron() and company_id = "filoLocal".current_company_id())
  with check ("filoLocal".is_patron() and company_id = "filoLocal".current_company_id());

create policy invitations_select on "filoLocal".invitations
  for select to authenticated using (
    "filoLocal".is_employee()
    and company_id = "filoLocal".current_company_id()
  );

create policy invitations_insert on "filoLocal".invitations
  for insert to authenticated with check (
    "filoLocal".is_manager_or_above()
    and company_id = "filoLocal".current_company_id()
    and invited_by = auth.uid()
  );

create policy invitations_update_revoke on "filoLocal".invitations
  for update to authenticated
  using ("filoLocal".is_manager_or_above() and company_id = "filoLocal".current_company_id())
  with check ("filoLocal".is_manager_or_above() and company_id = "filoLocal".current_company_id());

create policy consents_select_self on "filoLocal".legal_consents
  for select to authenticated using (user_id = auth.uid());

create policy consents_insert_self on "filoLocal".legal_consents
  for insert to authenticated with check (user_id = auth.uid());;
