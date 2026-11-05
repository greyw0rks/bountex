import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Task, Payment } from '../src/lib/types';
import type { PaymentIntent } from './payments.js';
import { AppError } from './security.js';
let client: SupabaseClient | undefined;
const serverKey = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
export function configured() {
  return !!(process.env.SUPABASE_URL && serverKey() && process.env.APP_ORIGIN);
}
export function db() {
  if (!configured())
    throw new AppError('Live mode is not configured. Try the preview workspace.', 503);
  return (client ??= createClient(
    process.env.SUPABASE_URL!,
    serverKey()!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ));
}
let readiness: { expires: number; ready: boolean } | undefined;
export async function backendReady(): Promise<boolean> {
  if (!configured()) return false;
  if (readiness && readiness.expires > Date.now()) return readiness.ready;
  let ready = false;
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: serverKey()!, Accept: 'application/openapi+json' },
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) {
      const schema = await response.json() as { paths?: Record<string, unknown> };
      const required = ['/profiles', '/tasks', '/challenges', '/sessions', '/uploads', '/payment_intents', '/rpc/bountex_mutate', '/rpc/bountex_begin_payment', '/rpc/bountex_start_payment', '/rpc/bountex_confirm_payment'];
      ready = required.every(path => !!schema.paths?.[path]);
    }
  } catch { /* A temporary network failure keeps the labeled preview available. */ }
  readiness = { expires: Date.now() + 10_000, ready };
  return ready;
}
export function checked<T>(result: {
  data: T;
  error: { message: string; code?: string } | null;
}): T {
  if (result.error) {
    const message = result.error.message;
    if (/Not authorized|Only the|not your/i.test(message)) throw new AppError(message, 403);
    if (result.error.code === '23505')
      throw new AppError('This record or transaction has already been used.', 409);
    if (/already|status|expired|claimed|limit/i.test(message)) throw new AppError(message, 409);
    console.error('Database operation failed:', result.error.code || 'unknown');
    throw new AppError('The request could not be saved. Please try again.', 503);
  }
  return result.data;
}
export function mapPayment(p: PaymentIntent): Payment {
  return {
    intentId: p.id,
    hash: p.hash,
    state: p.state,
    recipient: p.recipient,
    sender: p.sender,
    reference: p.reference,
    network: p.network,
    ...(p.block ? { block: p.block } : {}),
  };
}
export function mapTask(
  row: Record<string, unknown>,
  intent?: PaymentIntent,
  privateAccess = true,
): Task {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description),
    category: row.category as Task['category'],
    rewardLuna: Number(row.reward_luna),
    minutes: Number(row.minutes),
    deadline: String(row.deadline),
    creator: String(row.creator),
    creatorName: String(row.creator_name),
    avatar: String(row.avatar),
    status: row.status as Task['status'],
    worker: row.worker as string | null,
    requirements: row.requirements as string[],
    createdAt: String(row.created_at),
    ...(privateAccess && row.evidence ? { evidence: row.evidence as Task['evidence'] } : {}),
    ...(privateAccess && row.feedback ? { feedback: String(row.feedback) } : {}),
    ...(intent ? { payment: mapPayment(intent) } : {}),
  };
}
export async function taskFor(id: string, actor?: string) {
  const row = checked(await db().from('tasks').select('*').eq('id', id).maybeSingle()) as Record<
    string,
    unknown
  > | null;
  if (!row) throw new AppError('This bounty could not be found.', 404);
  if (row.status !== 'open' && actor !== row.creator && actor !== row.worker)
    throw new AppError('Only the worker and creator can view this bounty.', 403);
  return row;
}
export async function hydrate(id: string, actor: string) {
  const row = await taskFor(id, actor);
  const intent = checked(
    await db().from('payment_intents').select('*').eq('task_id', id).maybeSingle(),
  ) as PaymentIntent | null;
  return mapTask(row, intent || undefined, actor === row.creator || actor === row.worker);
}
