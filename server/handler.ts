import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  backendReady,
  checked,
  configured,
  db,
  hydrate,
  mapPayment,
  mapTask,
  taskFor,
} from './database.js';
import {
  AppError,
  loginMessage,
  normalizeAddress,
  sha256,
  token,
  verifyWalletSignature,
} from './security.js';
import { paymentBackendReady, verifyPayout, verifySender, type PaymentIntent } from './payments.js';
const network = () => (process.env.NIMIQ_NETWORK === 'mainnet' ? 'mainnet' : 'testnet');
const categories = z.enum(['Design', 'Development', 'Writing', 'Research', 'Community']);
const createSchema = z.object({
  title: z.string().trim().min(8).max(100),
  description: z.string().trim().min(30).max(5000),
  category: categories,
  rewardLuna: z.number().int().positive().max(1_000_000_000_000),
  minutes: z.number().int().min(5).max(1440),
  deadline: z.iso.datetime(),
  requirements: z.array(z.string().trim().min(3).max(500)).min(1).max(8),
});
const uploadTypes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'];
const evidenceSchema = z
  .object({
    note: z.string().trim().min(20).max(5000),
    url: z.union([z.literal(''), z.url().refine((x) => x.startsWith('https://'))]),
    files: z
      .array(
        z.object({
          name: z.string().max(200),
          path: z.string().max(500),
          size: z
            .number()
            .int()
            .positive()
            .max(10 * 1024 * 1024),
        }),
      )
      .max(5),
  })
  .refine((e) => e.url || e.files.length, 'Evidence needs a proof link or file.');
type Request = IncomingMessage & { body?: unknown };
async function body(req: Request): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, unknown>;
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 32 * 1024) throw new AppError('This request is too large.', 413);
    chunks.push(Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  } catch {
    throw new AppError('Send valid JSON.');
  }
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError(
      result.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; '),
    );
  return result.data;
}
function sessionToken(req: Request) {
  return /(?:^|;\s*)bountex_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
}
async function actor(req: Request, required = true): Promise<string | undefined> {
  const t = sessionToken(req);
  if (t) {
    const data = checked(
      await db()
        .from('sessions')
        .select('address')
        .eq('token_hash', sha256(t))
        .gt('expires_at', new Date().toISOString())
        .maybeSingle(),
    );
    if (data) return data.address as string;
  }
  if (required) throw new AppError('Connect and sign in with Nimiq Pay to continue.', 401);
}
function setSession(res: ServerResponse, value: string, age: number) {
  const secure = (process.env.APP_ORIGIN || '').startsWith('https://');
  res.setHeader(
    'Set-Cookie',
    `bountex_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`,
  );
}
function origin(req: Request) {
  if (req.headers.origin !== process.env.APP_ORIGIN)
    throw new AppError('This request came from an unrecognized origin.', 403);
}
async function throttle(req: Request, action: string, limit: number) {
  const ip = process.env.VERCEL
    ? String(
        req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || 'unknown',
      ).split(',')[0]
    : req.socket.remoteAddress || 'unknown';
  const allowed = checked(
    await db().rpc('bountex_rate_limit', { p_key: sha256(action + ':' + ip), p_limit: limit }),
  );
  if (!allowed) throw new AppError('Too many requests. Try again in a few minutes.', 429);
}
async function handle(req: Request, res: ServerResponse, path: string): Promise<unknown> {
  if (path === 'config' && req.method === 'GET') {
    const ready = await backendReady();
    return {
      configured: ready,
      network: network(),
      paymentsReady: ready && (await paymentBackendReady(network())),
    };
  }
  if (!configured())
    throw new AppError('The live backend is not configured. Use the preview workspace.', 503);
  if (!['GET', 'POST'].includes(req.method || '')) throw new AppError('Method not allowed.', 405);
  if (req.method === 'POST') origin(req);
  if (path === 'auth/challenge' && req.method === 'POST') {
    await throttle(req, 'auth', 100);
    const input = parse(
      z.object({ address: z.string().max(80), network: z.enum(['mainnet', 'testnet']) }),
      await body(req),
    );
    if (input.network !== network())
      throw new AppError('Your Nimiq Pay network differs from the app network.');
    const address = normalizeAddress(input.address),
      nonce = token(),
      id = randomUUID(),
      expires = new Date(Date.now() + 5 * 60_000).toISOString(),
      message = loginMessage(process.env.APP_ORIGIN!, address, network(), nonce, expires);
    checked(await db().from('challenges').insert({ id, address, message, expires_at: expires }));
    return { id, message };
  }
  if (path === 'auth/verify' && req.method === 'POST') {
    await throttle(req, 'verify', 150);
    const input = parse(
      z.object({
        challengeId: z.uuid(),
        publicKey: z.string().regex(/^[a-f0-9]{64}$/i),
        signature: z.string().regex(/^[a-f0-9]{128}$/i),
      }),
      await body(req),
    );
    const challenge = checked(
      await db()
        .from('challenges')
        .select('*')
        .eq('id', input.challengeId)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle(),
    );
    if (
      !challenge ||
      !verifyWalletSignature(challenge.address, challenge.message, input.publicKey, input.signature)
    )
      throw new AppError('Signature verification failed or the challenge expired.', 401);
    // The delete is conditional and returns one row to defeat simultaneous nonce replays.
    const consumed = checked(
      await db()
        .from('challenges')
        .delete()
        .eq('id', input.challengeId)
        .gt('expires_at', new Date().toISOString())
        .select('id'),
    );
    if (!consumed?.length) throw new AppError('This sign-in challenge has already been used.', 401);
    const session = token();
    checked(
      await db()
        .from('profiles')
        .upsert({ address: challenge.address }, { onConflict: 'address', ignoreDuplicates: true }),
    );
    checked(
      await db()
        .from('sessions')
        .insert({
          token_hash: sha256(session),
          address: challenge.address,
          expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
        }),
    );
    setSession(res, session, 7 * 86400);
    const p = checked(
      await db().from('profiles').select('name').eq('address', challenge.address).single(),
    );
    return {
      address: challenge.address,
      name: p?.name || 'Nimiq builder',
      accounts: [challenge.address],
    };
  }
  if (path === 'auth/me' && req.method === 'GET') {
    const address = await actor(req);
    const p = checked(await db().from('profiles').select('name').eq('address', address!).single());
    return { address, name: p?.name || 'Nimiq builder', accounts: [address] };
  }
  if (path === 'auth/logout' && req.method === 'POST') {
    const t = sessionToken(req);
    if (t) checked(await db().from('sessions').delete().eq('token_hash', sha256(t)));
    setSession(res, '', 0);
    return { ok: true };
  }
  if (path === 'tasks' && req.method === 'GET') {
    const address = await actor(req, false);
    let query = db().from('tasks').select('*').order('created_at', { ascending: false }).limit(200);
    query = address
      ? query.or(`status.eq.open,creator.eq.${address},worker.eq.${address}`)
      : query.eq('status', 'open');
    const rows = checked(await query) as Record<string, unknown>[];
    const ids = rows
      .filter((r) => r.creator === address || r.worker === address)
      .map((r) => String(r.id));
    const intents = ids.length
      ? (checked(
          await db().from('payment_intents').select('*').in('task_id', ids),
        ) as PaymentIntent[])
      : [];
    return rows.map((row) =>
      mapTask(
        row,
        intents.find((p) => p.task_id === row.id),
        row.creator === address || row.worker === address,
      ),
    );
  }
  if (path === 'tasks' && req.method === 'POST') {
    const address = (await actor(req))!;
    await throttle(req, 'create', 10);
    const input = parse(createSchema, await body(req));
    if (
      new Date(input.deadline).getTime() <= Date.now() ||
      new Date(input.deadline).getTime() > Date.now() + 90 * 86400_000
    )
      throw new AppError('Set a deadline within the next 90 days.');
    const p = checked(await db().from('profiles').select('name').eq('address', address).single());
    const row = checked(
      await db().rpc('bountex_create_task', {
        p_actor: address,
        p_data: {
          title: input.title,
          description: input.description,
          category: input.category,
          reward_luna: input.rewardLuna,
          minutes: input.minutes,
          deadline: input.deadline,
          requirements: input.requirements,
          creator_name: p?.name || 'Nimiq builder',
          avatar: 'NB',
        },
      }),
    ) as Record<string, unknown>;
    return mapTask(row);
  }
  const match = /^tasks\/([0-9a-f-]{36})\/([a-z-]+)$/.exec(path);
  if (!match || req.method !== 'POST') throw new AppError('Endpoint not found.', 404);
  const [, id, action] = match,
    address = (await actor(req))!;
  parse(z.uuid(), id);
  const task = await taskFor(id, address),
    input = await body(req);
  if (action === 'upload') {
    if (task.worker !== address || !['claimed', 'revision'].includes(String(task.status)))
      throw new AppError('Only the active worker can upload evidence.', 403);
    await throttle(req, 'upload', 60);
    const f = parse(
      z.object({
        name: z.string().min(1).max(200),
        size: z
          .number()
          .int()
          .positive()
          .max(10 * 1024 * 1024),
        type: z.enum(uploadTypes as [string, ...string[]]),
      }),
      input,
    );
    const path = `${id}/${sha256(address).slice(0, 16)}/${randomUUID()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const signed = checked(await db().storage.from('evidence').createSignedUploadUrl(path));
    if (!signed) throw new AppError('An upload URL could not be created.', 503);
    checked(
      await db()
        .from('uploads')
        .insert({ path, task_id: id, worker: address, name: f.name, size: f.size, mime: f.type }),
    );
    return { path, token: signed.token, url: signed.signedUrl };
  }
  if (action === 'evidence-url') {
    if (task.creator !== address && task.worker !== address)
      throw new AppError('Evidence is private to the worker and creator.', 403);
    const path = parse(z.string().min(1).max(500), input.path);
    const upload = checked(
      await db().from('uploads').select('path').eq('task_id', id).eq('path', path).maybeSingle(),
    );
    if (!upload) throw new AppError('This file does not belong to this bounty.', 404);
    const result = checked(await db().storage.from('evidence').createSignedUrl(path, 120));
    if (!result) throw new AppError('This evidence file is unavailable.', 404);
    return { url: result.signedUrl };
  }
  if (action === 'submit') {
    const evidence = parse(evidenceSchema, input.evidence);
    for (const f of evidence.files) {
      const record = checked(
        await db()
          .from('uploads')
          .select('*')
          .eq('path', f.path)
          .eq('task_id', id)
          .eq('worker', address)
          .maybeSingle(),
      );
      if (!record) throw new AppError('An attachment does not belong to your submission.');
      const folder = f.path.slice(0, f.path.lastIndexOf('/')),
        file = f.path.slice(f.path.lastIndexOf('/') + 1);
      const objects = checked(await db().storage.from('evidence').list(folder, { search: file }));
      const object = objects?.find((x) => x.name === file);
      if (!object || Number(object.metadata?.size) !== record.size)
        throw new AppError('An attachment has not uploaded completely.');
    }
    checked(
      await db().rpc('bountex_mutate', {
        p_id: id,
        p_actor: address,
        p_action: action,
        p_data: { evidence: { ...evidence, submittedAt: new Date().toISOString() } },
      }),
    );
    return hydrate(id, address);
  }
  if (['claim', 'release', 'cancel', 'approve', 'revise', 'reject', 'report'].includes(action)) {
    const feedback = String(input.feedback || '').trim();
    if (['revise', 'reject', 'report'].includes(action) && feedback.length < 10)
      throw new AppError('Give a reason with at least 10 characters.');
    if (feedback.length > 2000) throw new AppError('Keep feedback under 2,000 characters.');
    checked(
      await db().rpc('bountex_mutate', {
        p_id: id,
        p_actor: address,
        p_action: action,
        p_data: { feedback },
      }),
    );
    return hydrate(id, address);
  }
  const workerCheck = action === 'verify-payment' && task.worker === address;
  if (
    (task.creator !== address && !workerCheck) ||
    !['approved', 'paid'].includes(String(task.status))
  )
    throw new AppError(
      'Only the creator can manage payouts; the worker can verify a submitted payment.',
      403,
    );
  if (action === 'payment-intent') {
    const accounts = parse(z.array(z.string().max(80)).min(1).max(2), input.accounts);
    const sender = await verifySender(accounts, address, network());
    const intent = checked(
      await db().rpc('bountex_begin_payment', {
        p_id: id,
        p_actor: address,
        p_sender: sender,
        p_network: network(),
      }),
    ) as PaymentIntent;
    return mapPayment(intent);
  }
  const intent = checked(
    await db().from('payment_intents').select('*').eq('task_id', id).single(),
  ) as PaymentIntent;
  if (action === 'start-payment') {
    checked(await db().rpc('bountex_start_payment', { p_id: intent.id, p_actor: address }));
    return { ok: true };
  }
  if (action === 'cancel-payment') {
    if (input.intentId !== intent.id || intent.hash)
      throw new AppError('This payout must be reconciled before it can be retried.');
    // Used only after an explicit user rejection. Never called after unknown outcomes.
    checked(
      await db()
        .from('payment_intents')
        .update({ state: 'ready' })
        .eq('id', intent.id)
        .is('hash', null),
    );
    return { ok: true };
  }
  if (action === 'record-payment') {
    const hash = parse(z.string().regex(/^[a-f0-9]{64}$/i), input.hash).toLowerCase();
    if (input.intentId !== intent.id) throw new AppError('This payout intent does not match.');
    checked(
      await db().rpc('bountex_record_payment', { p_id: intent.id, p_actor: address, p_hash: hash }),
    );
    return hydrate(id, address);
  }
  if (action === 'verify-payment') {
    if (intent.state === 'confirmed') return hydrate(id, address);
    const result = await verifyPayout(intent);
    if (result.confirmed)
      checked(
        await db().rpc('bountex_confirm_payment', {
          p_id: intent.id,
          p_actor: address,
          p_block: result.block,
        }),
      );
    return hydrate(id, address);
  }
  throw new AppError('Endpoint not found.', 404);
}
export async function handler(req: Request, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const path = new URL(req.url || '/', 'http://local').pathname
      .replace(/^\/api\//, '')
      .replace(/\/$/, '');
    const data = await handle(req, res, path);
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (error) {
    const known = error instanceof AppError;
    if (!known) console.error('API error:', error instanceof Error ? error.name : 'unknown');
    res.statusCode = known ? error.status : 500;
    res.end(
      JSON.stringify({
        error: known
          ? error.message
          : 'The request could not be completed. Your work has not been lost.',
      }),
    );
  }
}
