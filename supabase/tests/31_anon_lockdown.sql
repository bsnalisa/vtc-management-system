-- Anonymous callers: only the public-site/token functions and the helpers anonymous policies depend on stay executable.
create temp table anon_ok (name text);
insert into anon_ok values ('trades_open_for_application'),('list_public_qualifications'),('submit_public_rpl_application'),('submit_sme_application'),
  ('application_window_status'),('get_survey_by_token'),('submit_survey_response'),('workflow_act_by_token'),('workflow_get_task_by_token'),
  ('get_graduation_invitation'),('respond_graduation_invitation'),('get_logbook_for_supervisor'),('supervisor_sign_entries');

-- 1. every other anonymously executable SECURITY DEFINER function must be a helper that an anonymous policy/default/view uses
select coalesce(string_agg(p.proname, ', '), '') as offenders
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'EXECUTE')
   and p.proname not in (select name from anon_ok)
   and p.proname <> 't_notif_count'  -- created by the test seed, not a migration
   and not exists (select 1 from pg_depend d join pg_policy pol on d.classid = 'pg_policy'::regclass and d.objid = pol.oid
                    where d.refclassid = 'pg_proc'::regclass and d.refobjid = p.oid
                      and (pol.polroles = '{0}' or (select oid from pg_roles where rolname = 'anon') = any (pol.polroles)))
   and not exists (select 1 from pg_depend d join pg_attrdef ad on d.classid = 'pg_attrdef'::regclass and d.objid = ad.oid where d.refclassid = 'pg_proc'::regclass and d.refobjid = p.oid)
   and not exists (select 1 from pg_depend d join pg_rewrite rw on d.classid = 'pg_rewrite'::regclass and d.objid = rw.oid join pg_class v on v.oid = rw.ev_class and v.relkind in ('v','m') where d.refclassid = 'pg_proc'::regclass and d.refobjid = p.oid) \gset
select public.assert(:'offenders' = '', 'anonymously callable functions outside the allowlist: ' || :'offenders');

-- 2. the allowlist is still callable by anonymous visitors
select public.assert((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in (select name from anon_ok) and has_function_privilege('anon', p.oid, 'EXECUTE')) >= 12, 'public-site and token functions stay open to anonymous visitors');

-- 3. business functions are closed to anonymous users but open to signed-in users and the service role
select public.assert(not has_function_privilege('anon', 'public.submit_transfer_request(uuid,text)'::regprocedure, 'EXECUTE'), 'anonymous users cannot call submit_transfer_request');
select public.assert(not has_function_privilege('anon', 'public.decide_transfer(uuid,text,text)'::regprocedure, 'EXECUTE'), 'anonymous users cannot call decide_transfer');
select public.assert(not has_function_privilege('anon', 'public.save_proof_settings(uuid,jsonb)'::regprocedure, 'EXECUTE'), 'anonymous users cannot call save_proof_settings');
select public.assert(has_function_privilege('authenticated', 'public.submit_transfer_request(uuid,text)'::regprocedure, 'EXECUTE'), 'signed-in users keep submit_transfer_request');
select public.assert(has_function_privilege('service_role', 'public.decide_transfer(uuid,text,text)'::regprocedure, 'EXECUTE'), 'the service role keeps decide_transfer');

-- 4. anonymous reads of every table still work: no policy fails with "permission denied for function"
do $$
declare t record; _bad text := '';
begin
  for t in select c.oid::regclass::text as tbl from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('anon', c.oid, 'SELECT') loop
    begin
      set local role anon;
      execute format('select 1 from %s limit 1', t.tbl);
      reset role;
    exception when others then
      reset role;
      if sqlerrm ilike '%permission denied for function%' then _bad := _bad || t.tbl || ' (' || sqlerrm || '); '; end if;
    end;
  end loop;
  perform public.assert(_bad = '', 'anonymous reads break on: ' || _bad);
end $$;

-- 5. a function created from now on is not callable by anonymous users
create function public.zz_new_definer() returns int language sql security definer as $$ select 1 $$;
select public.assert(not has_function_privilege('anon', 'public.zz_new_definer()'::regprocedure, 'EXECUTE'), 'new functions are closed to anonymous users by default');
drop function public.zz_new_definer();

-- 6. centre isolation on the identity review/audit tables
select public.assert((select count(*) from pg_policy where polname = 'Centre isolation' and polrelid in ('public.identity_review_cases'::regclass, 'public.identity_audit_events'::regclass) and polpermissive = false) = 2, 'identity review and audit tables carry the centre isolation policy');
select 'OK anonymous lockdown and identity centre isolation';
