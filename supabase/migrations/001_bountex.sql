-- Bountex uses a server-only wallet session. No anonymous table access.
create extension if not exists pgcrypto;
create table public.profiles (
  address text primary key,
  name text not null default 'Nimiq builder' check (length(name) between 2 and 40),
  created_at timestamptz not null default now()
);
create table public.challenges (
  id uuid primary key,
  address text not null,
  message text not null,
  expires_at timestamptz not null
);
create table public.sessions (
  token_hash text primary key,
  address text not null references public.profiles(address),
  expires_at timestamptz not null
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  creator text not null references public.profiles(address),
  creator_name text not null,
  avatar text not null default 'NB',
  worker text references public.profiles(address),
  title text not null check(length(title) between 8 and 100),
  description text not null check(length(description) between 30 and 5000),
  category text not null check(category in ('Design','Development','Writing','Research','Community')),
  reward_luna bigint not null check(reward_luna between 1 and 1000000000000),
  minutes integer not null check(minutes between 5 and 1440),
  deadline timestamptz not null,
  requirements jsonb not null check(jsonb_typeof(requirements)='array' and jsonb_array_length(requirements) between 1 and 8),
  status text not null default 'open' check(status in ('open','claimed','submitted','revision','approved','paid','rejected','cancelled')),
  evidence jsonb,
  feedback text check(length(feedback)<=2000),
  created_at timestamptz not null default now(),
  check(worker is null or worker <> creator),
  check((status in ('open','cancelled') and worker is null) or (status not in ('open','cancelled') and worker is not null))
);
create index tasks_creator_idx on public.tasks(creator,created_at desc);
create index tasks_worker_idx on public.tasks(worker,created_at desc);
create index tasks_open_idx on public.tasks(created_at desc) where status='open';
create table public.uploads (
  path text primary key,
  task_id uuid not null references public.tasks(id),
  worker text not null references public.profiles(address),
  name text not null,
  size integer not null check(size between 1 and 10485760),
  mime text not null,
  created_at timestamptz not null default now()
);
create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks(id),
  creator text not null references public.profiles(address),
  sender text not null,
  recipient text not null,
  reward_luna bigint not null check(reward_luna>0),
  reference text not null unique check(octet_length(reference)<=64),
  network text not null check(network in ('mainnet','testnet')),
  state text not null default 'ready' check(state in ('ready','uncertain','pending','confirmed')),
  hash text unique check(hash ~ '^[a-f0-9]{64}$'),
  block bigint,
  created_at timestamptz not null default now(),
  check(state not in ('pending','confirmed') or hash is not null)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id),
  actor text not null references public.profiles(address),
  reason text not null check(length(reason) between 10 and 2000),
  created_at timestamptz not null default now(),
  unique(task_id,actor)
);
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  requests integer not null
);
-- Server-only access: anonymous/publishable keys cannot read sessions, tasks or files.
alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.sessions enable row level security;
alter table public.tasks enable row level security;
alter table public.uploads enable row level security;
alter table public.payment_intents enable row level security;
alter table public.reports enable row level security;
alter table public.rate_limits enable row level security;
revoke all on public.profiles,public.challenges,public.sessions,public.tasks,public.uploads,public.payment_intents,public.reports,public.rate_limits from anon,authenticated;
grant all on public.profiles,public.challenges,public.sessions,public.tasks,public.uploads,public.payment_intents,public.reports,public.rate_limits to service_role;

create function public.bountex_rate_limit(p_key text,p_limit integer) returns boolean
language plpgsql set search_path=public as $$
declare n integer;
begin
  insert into rate_limits(key,window_start,requests) values(p_key,now(),1)
  on conflict(key) do update set
    requests=case when rate_limits.window_start < now()-interval '10 minutes' then 1 else rate_limits.requests+1 end,
    window_start=case when rate_limits.window_start < now()-interval '10 minutes' then now() else rate_limits.window_start end
  returning requests into n;
  return n<=p_limit;
end $$;

create function public.bountex_create_task(p_actor text,p_data jsonb) returns jsonb
language plpgsql set search_path=public as $$
declare t tasks;
begin
  -- Lock the profile to make this cap hold during simultaneous publish requests.
  perform 1 from profiles where address=p_actor for update;
  if not found then raise exception 'Not authorized'; end if;
  if (select count(*) from tasks where creator=p_actor and status in ('open','claimed','submitted','revision','approved'))>=3 then
    raise exception 'Active bounty limit reached. Complete and pay existing work before posting more.';
  end if;
  if (p_data->>'deadline')::timestamptz<=now() then raise exception 'Deadline expired'; end if;
  insert into tasks(creator,creator_name,avatar,title,description,category,reward_luna,minutes,deadline,requirements)
  values(p_actor,p_data->>'creator_name',p_data->>'avatar',p_data->>'title',p_data->>'description',p_data->>'category',
    (p_data->>'reward_luna')::bigint,(p_data->>'minutes')::integer,(p_data->>'deadline')::timestamptz,p_data->'requirements') returning * into t;
  return to_jsonb(t);
end $$;

create function public.bountex_mutate(p_id uuid,p_actor text,p_action text,p_data jsonb) returns jsonb
language plpgsql set search_path=public as $$
declare t tasks;
begin
  select * into t from tasks where id=p_id for update;
  if not found then raise exception 'Bounty not found'; end if;
  if p_action='claim' then
    if t.creator=p_actor then raise exception 'Not authorized: creators cannot claim their own work'; end if;
    if t.status<>'open' then raise exception 'Bounty already claimed'; end if;
    if t.deadline<=now() then raise exception 'Bounty expired'; end if;
    perform 1 from profiles where address=p_actor for update;
    if (select count(*) from tasks where worker=p_actor and status in ('claimed','revision'))>=5 then raise exception 'Active work limit reached'; end if;
    update tasks set worker=p_actor,status='claimed' where id=p_id;
  elsif p_action in ('submit','release') then
    if t.worker is distinct from p_actor then raise exception 'Only the worker can modify this submission'; end if;
    if p_action='release' then
      if t.status<>'claimed' or t.evidence is not null then raise exception 'Only unsubmitted work can be released'; end if;
      update tasks set worker=null,status='open' where id=p_id;
    else
      if t.status not in ('claimed','revision') then raise exception 'Submission status has changed'; end if;
      if t.deadline<=now() then raise exception 'Submission deadline expired'; end if;
      update tasks set evidence=p_data->'evidence',status='submitted' where id=p_id;
    end if;
  elsif p_action='cancel' then
    if t.creator<>p_actor then raise exception 'Only the creator can cancel'; end if;
    if t.status<>'open' then raise exception 'Only an unclaimed bounty can be cancelled'; end if;
    update tasks set status='cancelled' where id=p_id;
  elsif p_action in ('approve','revise','reject') then
    if t.creator<>p_actor then raise exception 'Only the creator can review work'; end if;
    if t.status<>'submitted' then raise exception 'Review status has changed'; end if;
    if p_action in ('revise','reject') and length(p_data->>'feedback')<10 then raise exception 'Feedback needs a clear reason'; end if;
    update tasks set status=case p_action when 'approve' then 'approved' when 'revise' then 'revision' else 'rejected' end,
      feedback=p_data->>'feedback',deadline=case when p_action='revise' then greatest(deadline,now()+interval '48 hours') else deadline end where id=p_id;
  elsif p_action='report' then
    if t.worker is distinct from p_actor then raise exception 'Only the worker can report this bounty'; end if;
    insert into reports(task_id,actor,reason) values(p_id,p_actor,p_data->>'feedback')
      on conflict(task_id,actor) do update set reason=excluded.reason;
  else raise exception 'Unknown action'; end if;
  select * into t from tasks where id=p_id;
  return to_jsonb(t);
end $$;

create function public.bountex_begin_payment(p_id uuid,p_actor text,p_sender text,p_network text) returns jsonb
language plpgsql set search_path=public as $$
declare t tasks;p payment_intents;
begin
  select * into t from tasks where id=p_id for update;
  if t.creator is distinct from p_actor then raise exception 'Only the creator can pay'; end if;
  if t.status not in ('approved','paid') then raise exception 'Work must be approved before payment'; end if;
  select * into p from payment_intents where task_id=p_id for update;
  if found then
    if p.network<>p_network then raise exception 'Payment network has changed'; end if;
    if p.state='ready' and p.hash is null then
      update payment_intents set sender=p_sender where id=p.id returning * into p;
    end if;
    return to_jsonb(p);
  end if;
  insert into payment_intents(task_id,creator,sender,recipient,reward_luna,reference,network)
  values(t.id,p_actor,p_sender,t.worker,t.reward_luna,'BXT:'||replace(t.id::text,'-',''),p_network) returning * into p;
  return to_jsonb(p);
end $$;

create function public.bountex_start_payment(p_id uuid,p_actor text) returns boolean
language plpgsql set search_path=public as $$
begin
  update payment_intents set state='uncertain' where id=p_id and creator=p_actor and state='ready' and hash is null;
  if not found then raise exception 'Payment already started. Recover the existing payment instead.'; end if;
  return true;
end $$;

create function public.bountex_record_payment(p_id uuid,p_actor text,p_hash text) returns boolean
language plpgsql set search_path=public as $$
declare p payment_intents;
begin
  select * into p from payment_intents where id=p_id for update;
  if p.creator is distinct from p_actor then raise exception 'Only the creator can record this payment'; end if;
  if p.hash is not null and p.hash<>p_hash then raise exception 'Payment already has a different transaction hash'; end if;
  if p.state='confirmed' then return true; end if;
  if p.state not in ('uncertain','pending') then raise exception 'Payment has not started'; end if;
  update payment_intents set hash=p_hash,state='pending' where id=p_id;
  return true;
end $$;

create function public.bountex_confirm_payment(p_id uuid,p_actor text,p_block bigint) returns boolean
language plpgsql set search_path=public as $$
declare p payment_intents;t tasks;
begin
  select * into p from payment_intents where id=p_id;
  select * into t from tasks where id=p.task_id for update;
  select * into p from payment_intents where id=p_id for update;
  if p.creator is distinct from p_actor and t.worker is distinct from p_actor then raise exception 'Only the creator or worker can confirm this payment'; end if;
  if p.state='confirmed' then return true; end if;
  if p.state<>'pending' or p.hash is null then raise exception 'Payment is not pending'; end if;
  if t.status<>'approved' then raise exception 'Task status has changed'; end if;
  update payment_intents set state='confirmed',block=p_block where id=p.id;
  update tasks set status='paid' where id=t.id;
  return true;
end $$;

revoke execute on function public.bountex_rate_limit(text,integer),public.bountex_create_task(text,jsonb),public.bountex_mutate(uuid,text,text,jsonb),
  public.bountex_begin_payment(uuid,text,text,text),public.bountex_start_payment(uuid,text),public.bountex_record_payment(uuid,text,text),public.bountex_confirm_payment(uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.bountex_rate_limit(text,integer),public.bountex_create_task(text,jsonb),public.bountex_mutate(uuid,text,text,jsonb),
  public.bountex_begin_payment(uuid,text,text,text),public.bountex_start_payment(uuid,text),public.bountex_record_payment(uuid,text,text),public.bountex_confirm_payment(uuid,text,bigint) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('evidence','evidence',false,10485760,array['image/png','image/jpeg','image/webp','application/pdf','text/plain'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
