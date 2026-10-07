\set ON_ERROR_STOP on
create or replace function public.assert(cond boolean, msg text) returns void language plpgsql as $$ begin if cond is not true then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
create or replace function public.expect_error(q text, pat text, msg text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if sqlerrm ilike '%'||pat||'%' then return; end if;
    raise exception 'ASSERT FAILED: % (wrong error: %)', msg, sqlerrm;
  end;
  raise exception 'ASSERT FAILED: % (no error raised)', msg;
end $$;

insert into organizations (id, name, subdomain, trainee_id_prefix, active) values
 ('a0000000-0000-0000-0000-00000000000a','Org A','orga','062',true),
 ('b0000000-0000-0000-0000-00000000000b','Org B','orgb','099',true);
-- users
insert into auth.users (id,email) values
 ('11111111-0000-0000-0000-000000000001','admin@a.test'),
 ('11111111-0000-0000-0000-000000000002','librarian@a.test'),
 ('11111111-0000-0000-0000-000000000003','trainee1@a.test'),
 ('11111111-0000-0000-0000-000000000004','trainer@a.test'),
 ('11111111-0000-0000-0000-000000000005','sme@a.test'),
 ('11111111-0000-0000-0000-000000000006','print@a.test'),
 ('11111111-0000-0000-0000-000000000007','admin@b.test'),
 ('11111111-0000-0000-0000-000000000008','trainee2@a.test'),
 ('11111111-0000-0000-0000-000000000009','sme2@a.test');
update profiles p set full_name = split_part(u.email,'@',1), email = u.email from auth.users u where u.id = p.user_id;
insert into user_roles (user_id, role, organization_id) values
 ('11111111-0000-0000-0000-000000000001','admin','a0000000-0000-0000-0000-00000000000a'),
 ('11111111-0000-0000-0000-000000000002','librarian','a0000000-0000-0000-0000-00000000000a'),
 ('11111111-0000-0000-0000-000000000003','trainee','a0000000-0000-0000-0000-00000000000a'),
 ('11111111-0000-0000-0000-000000000004','trainer','a0000000-0000-0000-0000-00000000000a'),
 ('11111111-0000-0000-0000-000000000005','subject_matter_expert','a0000000-0000-0000-0000-00000000000a'),
 ('11111111-0000-0000-0000-000000000006','printing_distribution_officer','a0000000-0000-0000-0000-00000000000a'),
 ('11111111-0000-0000-0000-000000000007','admin','b0000000-0000-0000-0000-00000000000b'),
 ('11111111-0000-0000-0000-000000000008','trainee','a0000000-0000-0000-0000-00000000000a'),
 ('11111111-0000-0000-0000-000000000009','subject_matter_expert','a0000000-0000-0000-0000-00000000000a');
insert into trades (id,name,code) values ('c0000000-0000-0000-0000-000000000001','Welding','WLD');
insert into trainees (id,user_id,organization_id,trainee_id,first_name,last_name,gender,date_of_birth,national_id,phone,address,trade_id,training_mode,level,academic_year,status) values
 ('d0000000-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000003','a0000000-0000-0000-0000-00000000000a','062-26-00001','Tina','One','female','2000-01-01','N1','+264811111111','x','c0000000-0000-0000-0000-000000000001','fulltime',1,'2026','active'),
 ('d0000000-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000008','a0000000-0000-0000-0000-00000000000a','062-26-00002','Tom','Two','male','2000-01-01','N2','0812222222','x','c0000000-0000-0000-0000-000000000001','fulltime',1,'2026','active');
insert into qualifications (id,organization_id,qualification_title,qualification_code,qualification_type,nqf_level,duration_value,created_by) values
 ('e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','Welding L1','WLD1',(select enumlabel::text from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='qualification_type' order by enumsortorder limit 1)::qualification_type,1,12,'11111111-0000-0000-0000-000000000001');
update trainees set qualification_id='e0000000-0000-0000-0000-000000000001';
insert into unit_standards (id,unit_no,module_title,level,credit) values ('f0000000-0000-0000-0000-000000000001','US-1','Safety',1,5);
create or replace function public.t_notif_count(uid uuid, ttl text default null, typ text default null) returns bigint language sql security definer as $$
  select count(*) from public.notifications where user_id = uid and (ttl is null or title ilike ttl) and (typ is null or type = typ) $$;
grant execute on function public.t_notif_count(uuid,text,text) to authenticated, anon;

grant execute on function public.assert(boolean,text), public.expect_error(text,text,text) to authenticated, anon, service_role;
