import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
let pg: PGlite;
const creator = 'creator',
  worker = 'worker',
  other = 'other';
async function createTask(owner = creator) {
  const data = {
    title: 'Test a real workflow',
    description: 'Please test this working task and submit clear evidence of your findings.',
    category: 'Development',
    reward_luna: 25000000,
    minutes: 20,
    deadline: new Date(Date.now() + 86400_000).toISOString(),
    requirements: ['A proof link and detailed findings'],
    creator_name: 'A builder',
    avatar: 'AB',
  };
  const r = await pg.query<{ data: { id: string } }>(
    'select bountex_create_task($1,$2::jsonb) as data',
    [owner, JSON.stringify(data)],
  );
  return r.rows[0].data.id;
}
const mutate = (id: string, actor: string, action: string, data = {}) =>
  pg.query('select bountex_mutate($1::uuid,$2,$3,$4::jsonb)', [
    id,
    actor,
    action,
    JSON.stringify(data),
  ]);
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    'create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);',
  );
  const sql = readFileSync(
    new URL('../supabase/migrations/001_bountex.sql', import.meta.url),
    'utf8',
  ).replace('create extension if not exists pgcrypto;', '');
  await pg.exec(sql);
  await pg.query('insert into profiles(address) values($1),($2),($3)', [creator, worker, other]);
}, 30000);
afterAll(async () => {
  await pg?.close();
});
beforeEach(async () => {
  await pg.exec('truncate tasks, challenges cascade');
});
describe('database lifecycle and permissions', () => {
  it('allows one claimant and prevents another claimant taking the same task', async () => {
    const id = await createTask();
    await mutate(id, worker, 'claim');
    await expect(mutate(id, other, 'claim')).rejects.toThrow('already claimed');
    await expect(mutate(id, creator, 'submit', { evidence: {} })).rejects.toThrow(
      'Only the worker',
    );
  });
  it('prevents creators claiming their own rewards', async () => {
    const id = await createTask();
    await expect(mutate(id, creator, 'claim')).rejects.toThrow('creators cannot claim');
    await mutate(id, creator, 'cancel');
  });
  it('caps unpaid promises and restores capacity when an open task is cancelled', async () => {
    const id = await createTask();
    await createTask();
    await createTask();
    await expect(createTask()).rejects.toThrow('limit reached');
    await mutate(id, creator, 'cancel');
    await expect(createTask()).resolves.toBeTypeOf('string');
  });
  it('requires submission before approval and supports revision followed by resubmission', async () => {
    const id = await createTask(other);
    await mutate(id, worker, 'claim');
    await expect(mutate(id, other, 'approve')).rejects.toThrow('Review status');
    const evidence = {
      note: 'Here is the completed work and my findings.',
      url: 'https://example.com/evidence',
      files: [],
      submittedAt: new Date().toISOString(),
    };
    await mutate(id, worker, 'submit', { evidence });
    await expect(mutate(id, worker, 'approve')).rejects.toThrow('Only the creator');
    await mutate(id, other, 'revise', { feedback: 'Please include a screenshot of the issue.' });
    await mutate(id, worker, 'submit', { evidence });
    await mutate(id, other, 'approve', { feedback: 'Great work, thank you.' });
    const r = await pg.query<{ status: string }>('select status from tasks where id=$1', [id]);
    expect(r.rows[0].status).toBe('approved');
  });
  it('rejects public role access to task and session data', async () => {
    await pg.exec('set role anon');
    try {
      await expect(pg.query('select * from sessions')).rejects.toThrow('permission denied');
      await expect(pg.query('select * from tasks')).rejects.toThrow('permission denied');
      await expect(pg.query("select bountex_rate_limit('key',10)")).rejects.toThrow(
        'permission denied',
      );
    } finally {
      await pg.exec('reset role');
    }
  });
  it('makes sign-in challenges consumable only once', async () => {
    const id = crypto.randomUUID();
    await pg.query("insert into challenges values($1,$2,$3,now()+interval '5 minutes')", [
      id,
      creator,
      'signed challenge',
    ]);
    const consume = () =>
      pg.query('delete from challenges where id=$1 and expires_at>now() returning id', [id]);
    const results = await Promise.all([consume(), consume()]);
    expect(results.map((r) => r.rows.length).sort()).toEqual([0, 1]);
  });
});
describe('payout idempotency', () => {
  it('freezes the recipient and amount, locks payout once, and prevents duplicate transaction hashes', async () => {
    const id = await createTask('other');
    await mutate(id, worker, 'claim');
    await mutate(id, worker, 'submit', {
      evidence: { note: 'Done', url: 'https://example.com', files: [] },
    });
    await mutate(id, 'other', 'approve');
    const first = await pg.query<{ p: { id: string; recipient: string; reward_luna: number } }>(
      'select bountex_begin_payment($1,$2,$3,$4) as p',
      [id, 'other', 'htlc-a', 'testnet'],
    );
    const p = first.rows[0].p;
    expect(p.recipient).toBe(worker);
    expect(p.reward_luna).toBe(25000000);
    const second = await pg.query<{ p: { id: string } }>(
      'select bountex_begin_payment($1,$2,$3,$4) as p',
      [id, 'other', 'htlc-b', 'testnet'],
    );
    expect(second.rows[0].p.id).toBe(p.id);
    await pg.query('select bountex_start_payment($1,$2)', [p.id, 'other']);
    await expect(pg.query('select bountex_start_payment($1,$2)', [p.id, 'other'])).rejects.toThrow(
      'already started',
    );
    const hash = 'a'.repeat(64);
    await pg.query('select bountex_record_payment($1,$2,$3)', [p.id, 'other', hash]);
    await pg.query('select bountex_record_payment($1,$2,$3)', [p.id, 'other', hash]);
    await expect(
      pg.query('select bountex_record_payment($1,$2,$3)', [p.id, 'other', 'b'.repeat(64)]),
    ).rejects.toThrow('different transaction');
    await expect(
      pg.query('select bountex_confirm_payment($1,$2,$3)', [p.id, creator, 32]),
    ).rejects.toThrow('Only the creator or worker');
    await pg.query('select bountex_confirm_payment($1,$2,$3)', [p.id, worker, 32]);
    await pg.query('select bountex_confirm_payment($1,$2,$3)', [p.id, 'other', 32]);
    const r = await pg.query<{ status: string }>('select status from tasks where id=$1', [id]);
    expect(r.rows[0].status).toBe('paid');
    const another = await createTask('other');
    await mutate(another, worker, 'claim');
    await mutate(another, worker, 'submit', { evidence: {} });
    await mutate(another, 'other', 'approve');
    const r2 = await pg.query<{ p: { id: string } }>(
      'select bountex_begin_payment($1,$2,$3,$4) as p',
      [another, 'other', 'htlc-b', 'testnet'],
    );
    await pg.query('select bountex_start_payment($1,$2)', [r2.rows[0].p.id, 'other']);
    await expect(
      pg.query('select bountex_record_payment($1,$2,$3)', [r2.rows[0].p.id, 'other', hash]),
    ).rejects.toThrow('unique');
  });
});
