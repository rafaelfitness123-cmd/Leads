import { supabase } from './supabase';

type Constraint =
  | { type: 'where'; field: string; op: string; value: any }
  | { type: 'orderBy'; field: string; direction: 'asc' | 'desc' }
  | { type: 'limit'; count: number };

type Ref = { path: string; constraints?: Constraint[] };

const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

const TABLES: Record<string, string> = {
  users: 'profiles',
  boards: 'boards',
  leads: 'leads',
  campaigns: 'message_campaigns',
};

const camelToSnake = (value: string) => value.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);
const snakeToCamel = (value: string) => value.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export class Timestamp {
  private value: Date;
  constructor(value: Date | string | number) { this.value = new Date(value); }
  static now() { return new Timestamp(new Date()); }
  static fromDate(date: Date) { return new Timestamp(date); }
  toDate() { return new Date(this.value); }
  toMillis() { return this.value.getTime(); }
  toJSON() { return this.value.toISOString(); }
}

function isTimestampField(key: string) {
  return key.endsWith('_at') || key === 'created_at';
}

function toDbObject(input: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [key, raw] of Object.entries(input || {})) {
    if (key === 'uid') continue;
    let value = raw;
    if (value instanceof Timestamp) value = value.toJSON();
    if (value?.__increment !== undefined) value = raw;
    out[camelToSnake(key)] = value;
  }
  return out;
}

function fromDbObject(row: Record<string, any>, table: string) {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(row || {})) {
    const outKey = snakeToCamel(key);
    out[outKey] = isTimestampField(key) && value ? new Timestamp(value as string) : value;
  }
  if (table === 'profiles') out.uid = row.id;
  return out;
}

function resolve(path: string) {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'campaigns' && parts[2] === 'variations') {
    return { table: 'message_variations', id: parts[3] ?? null, scope: { campaign_id: parts[1] } };
  }
  if (parts[0] === 'leads' && parts[2] === 'history') {
    return { table: 'lead_history', id: parts[3] ?? null, scope: { lead_id: parts[1] } };
  }
  return { table: TABLES[parts[0]] ?? parts[0], id: parts[1] ?? null, scope: {} as Record<string, any> };
}

export function collection(_db: any, path: string): Ref { return { path }; }
export function doc(_dbOrRef: any, ...parts: string[]): Ref {
  if (typeof _dbOrRef?.path === 'string') return { path: [_dbOrRef.path, ...parts].join('/') };
  return { path: parts.join('/') };
}
export function where(field: string, op: string, value: any): Constraint { return { type: 'where', field, op, value }; }
export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): Constraint { return { type: 'orderBy', field, direction }; }
export function limit(count: number): Constraint { return { type: 'limit', count }; }
export function query(ref: Ref, ...constraints: Constraint[]): Ref { return { ...ref, constraints }; }
export function increment(amount: number) { return { __increment: amount }; }

async function execute(ref: Ref) {
  const { table, scope } = resolve(ref.path);
  let q: any = supabase.from(table).select('*');
  for (const [k, v] of Object.entries(scope)) q = q.eq(k, v);
  for (const c of ref.constraints || []) {
    if (c.type === 'where') {
      const field = camelToSnake(c.field);
      if (c.op === '==') q = q.eq(field, c.value);
      else if (c.op === '!=') q = q.neq(field, c.value);
      else if (c.op === '>') q = q.gt(field, c.value);
      else if (c.op === '>=') q = q.gte(field, c.value);
      else if (c.op === '<') q = q.lt(field, c.value);
      else if (c.op === '<=') q = q.lte(field, c.value);
    }
    if (c.type === 'orderBy') q = q.order(camelToSnake(c.field), { ascending: c.direction !== 'desc' });
    if (c.type === 'limit') q = q.limit(c.count);
  }
  const { data, error } = await q;
  if (error) throw error;
  return { table, rows: data || [] };
}

function makeDoc(table: string, row: any) {
  return {
    id: row.id,
    data: () => fromDbObject(row, table),
    exists: () => Boolean(row),
  };
}

export async function getDocs(ref: Ref) {
  const { table, rows } = await execute(ref);
  const docs = rows.map((row: any) => makeDoc(table, row));
  return { docs, size: docs.length, empty: docs.length === 0 };
}

export async function getDoc(ref: Ref) {
  const { table, id, scope } = resolve(ref.path);
  if (!id) throw new Error(`Documento sem ID: ${ref.path}`);
  let q: any = supabase.from(table).select('*').eq('id', id);
  for (const [k, v] of Object.entries(scope)) q = q.eq(k, v);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return {
    id,
    data: () => data ? fromDbObject(data, table) : undefined,
    exists: () => Boolean(data),
  };
}

export const getDocFromServer = getDoc;

export async function addDoc(ref: Ref, input: Record<string, any>) {
  const { table, scope } = resolve(ref.path);
  const payload = { ...toDbObject(input), ...scope };
  const { data, error } = await supabase.from(table).insert(payload).select('id').single();
  if (error) throw error;
  notify();
  return { id: data.id };
}

export async function setDoc(ref: Ref, input: Record<string, any>) {
  const { table, id, scope } = resolve(ref.path);
  if (!id) throw new Error(`Documento sem ID: ${ref.path}`);
  const payload = { ...toDbObject(input), ...scope, id };
  const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
  if (error) throw error;
  notify();
}

export async function updateDoc(ref: Ref, input: Record<string, any>) {
  const { table, id, scope } = resolve(ref.path);
  if (!id) throw new Error(`Documento sem ID: ${ref.path}`);
  const payload = toDbObject(input);
  const increments = Object.entries(payload).filter(([, v]: any) => v?.__increment !== undefined);
  if (increments.length) {
    const current = await getDoc(ref);
    const currentData: any = current.data() || {};
    for (const [snakeKey, marker] of increments as any[]) {
      const camelKey = snakeToCamel(snakeKey);
      payload[snakeKey] = Number(currentData[camelKey] || 0) + Number(marker.__increment || 0);
    }
  }
  let q: any = supabase.from(table).update(payload).eq('id', id);
  for (const [k, v] of Object.entries(scope)) q = q.eq(k, v);
  const { error } = await q;
  if (error) throw error;
  notify();
}

export async function deleteDoc(ref: Ref) {
  const { table, id, scope } = resolve(ref.path);
  if (!id) throw new Error(`Documento sem ID: ${ref.path}`);
  let q: any = supabase.from(table).delete().eq('id', id);
  for (const [k, v] of Object.entries(scope)) q = q.eq(k, v);
  const { error } = await q;
  if (error) throw error;
  notify();
}

export function onSnapshot(ref: Ref, onNext: (snap: any) => void, onError?: (error: any) => void) {
  let active = true;
  const refresh = async () => {
    try {
      const snap = await getDocs(ref);
      if (active) onNext(snap);
    } catch (error) {
      if (active && onError) onError(error);
    }
  };
  listeners.add(refresh);
  refresh();
  return () => {
    active = false;
    listeners.delete(refresh);
  };
}
