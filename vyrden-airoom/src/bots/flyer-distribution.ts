import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type FlyerChannel = 'email';

export interface FlyerPilotContact {
  pilotId: string;
  channel: FlyerChannel;
  contact: string;
  segment: string;
  assetVersion: string;
  allowed: boolean;
  optOut?: boolean;
}

export interface FlyerSendOptions {
  hourlyLimit?: number;
  dailyLimit?: number;
  now?: Date;
}

export interface FlyerSendRecord {
  id: string;
  pilotId: string;
  channel: FlyerChannel;
  contact: string;
  segment: string;
  assetVersion: string;
  status: 'sent';
  sentAt: string;
  evidenceStamp: string;
}

export interface FlyerSendResult {
  ok: boolean;
  status: 'sent' | 'blocked';
  reason: string;
  missingFields: string[];
  evidenceStamp: string | null;
  record: FlyerSendRecord | null;
}

export interface FlyerFeedbackInput {
  pilotId: string;
  channel: FlyerChannel;
  contact: string;
  message: string;
  source?: string;
  receivedAt?: string;
}

export interface FlyerFeedbackResult {
  ok: boolean;
  type: 'reply' | 'booked' | 'feedback_received';
  evidenceStamp: string;
  monitorEventId: string;
  optOutRecorded: boolean;
}

const DEFAULT_HOURLY_LIMIT = 25;
const DEFAULT_DAILY_LIMIT = 100;

export function parsePilotList(raw: string, format: 'json' | 'csv'): FlyerPilotContact[] {
  if (format === 'json') {
    const parsed = JSON.parse(raw) as FlyerPilotContact[];
    if (!Array.isArray(parsed)) throw new Error('pilot_json_must_be_array');
    return parsed;
  }

  const [headerLine, ...rows] = raw.trim().split(/\r?\n/);
  if (!headerLine) return [];
  const headers = headerLine.split(',').map((header) => header.trim());
  return rows.filter(Boolean).map((row) => {
    const values = row.split(',').map((value) => value.trim());
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    return {
      pilotId: record['pilotId'] ?? '',
      channel: (record['channel'] ?? '') as FlyerChannel,
      contact: record['contact'] ?? '',
      segment: record['segment'] ?? '',
      assetVersion: record['assetVersion'] ?? '',
      allowed: (record['allowed'] ?? '').toLowerCase() === 'true',
      optOut: (record['optOut'] ?? '').toLowerCase() === 'true',
    };
  });
}

export function sendFlyer(contact: FlyerPilotContact, options: FlyerSendOptions = {}): FlyerSendResult {
  const missingFields = missingSendFields(contact);
  if (missingFields.length > 0) {
    return blocked('FLYER_SEND_REQUIRED_FIELDS_MISSING', missingFields);
  }

  if (contact.channel !== 'email') {
    return blocked('FLYER_CHANNEL_NOT_ALLOWED', ['channel']);
  }

  if (!contact.allowed) {
    return blocked('FLYER_CONSENT_REQUIRED', ['allowed']);
  }

  if (contact.optOut || isOptedOut(contact.contact)) {
    return blocked('FLYER_OPT_OUT_ACTIVE', ['contact']);
  }

  const priorSends = readSendRecords();
  if (priorSends.some((send) => dedupeKey(send) === dedupeKey(contact))) {
    return blocked('FLYER_DUPLICATE_SEND_BLOCKED', ['pilotId', 'contact', 'assetVersion']);
  }

  const now = options.now ?? new Date();
  const hourlyLimit = options.hourlyLimit ?? DEFAULT_HOURLY_LIMIT;
  const dailyLimit = options.dailyLimit ?? DEFAULT_DAILY_LIMIT;
  const sendsThisHour = priorSends.filter((send) => withinMs(send.sentAt, now, 60 * 60 * 1000)).length;
  const sendsToday = priorSends.filter((send) => withinMs(send.sentAt, now, 24 * 60 * 60 * 1000)).length;
  if (sendsThisHour >= hourlyLimit) return blocked('FLYER_HOURLY_THROTTLE_EXCEEDED', ['hourlyLimit']);
  if (sendsToday >= dailyLimit) return blocked('FLYER_DAILY_THROTTLE_EXCEEDED', ['dailyLimit']);

  const sentAt = now.toISOString();
  const id = `flyer_send_${randomUUID()}`;
  const evidenceStamp = buildEvidenceStamp({ id, pilotId: contact.pilotId, contact: contact.contact, assetVersion: contact.assetVersion, sentAt });
  const record: FlyerSendRecord = {
    id,
    pilotId: contact.pilotId,
    channel: contact.channel,
    contact: contact.contact,
    segment: contact.segment,
    assetVersion: contact.assetVersion,
    status: 'sent',
    sentAt,
    evidenceStamp,
  };

  appendJsonl(sendLogPath(), record);
  appendJsonl(outboxPath(), {
    ...record,
    subject: `VYRDX pilot ${contact.assetVersion}`,
    body: `VYRDX evidence-backed pilot invitation for ${contact.segment}. Reply STOP to opt out.`,
  });

  return {
    ok: true,
    status: 'sent',
    reason: 'FLYER_SEND_EVIDENCE_WRITTEN',
    missingFields: [],
    evidenceStamp,
    record,
  };
}

export function ingestFlyerFeedback(input: FlyerFeedbackInput): FlyerFeedbackResult {
  const missing = missingFeedbackFields(input);
  if (missing.length > 0) {
    throw new Error(`feedback_required_fields_missing:${missing.join(',')}`);
  }

  const normalized = input.message.toLowerCase();
  const optOutRecorded = /\b(stop|unsubscribe|opt[- ]?out)\b/.test(normalized);
  const booked = /\b(book|booked|meeting|call|demo)\b/.test(normalized);
  if (optOutRecorded) recordOptOut(input.contact);

  const type: FlyerFeedbackResult['type'] = optOutRecorded ? 'feedback_received' : booked ? 'booked' : 'reply';
  const launchEventInput = {
    type,
    room: 'launch-feedback',
    source: input.source ?? 'vyrden-flyer-bot',
    status: 'received',
    reason: optOutRecorded ? 'opt_out_received' : booked ? 'booking_intent_received' : 'reply_received',
    payload: {
      pilotId: input.pilotId,
      channel: input.channel,
      contact: input.contact,
      message: input.message,
      optOutRecorded,
    },
  } as const;
  const monitorEvent = recordLaunchEvent(input.receivedAt
    ? { ...launchEventInput, occurredAt: input.receivedAt }
    : launchEventInput);

  return {
    ok: true,
    type,
    evidenceStamp: monitorEvent.evidenceStamp,
    monitorEventId: monitorEvent.id,
    optOutRecorded,
  };
}

export function resetFlyerBotStateForTest(): void {
  writeFileEnsured(sendLogPath(), '');
  writeFileEnsured(outboxPath(), '');
  writeFileEnsured(optOutPath(), JSON.stringify([], null, 2));
}

function missingSendFields(contact: Partial<FlyerPilotContact>): string[] {
  const missing: string[] = [];
  if (!contact.pilotId) missing.push('pilotId');
  if (!contact.assetVersion) missing.push('assetVersion');
  if (!contact.channel) missing.push('channel');
  if (!contact.contact) missing.push('contact');
  if (!contact.segment) missing.push('segment');
  if (contact.allowed !== true) missing.push('allowed');
  return missing;
}

function missingFeedbackFields(input: Partial<FlyerFeedbackInput>): string[] {
  const missing: string[] = [];
  if (!input.pilotId) missing.push('pilotId');
  if (!input.channel) missing.push('channel');
  if (!input.contact) missing.push('contact');
  if (!input.message) missing.push('message');
  return missing;
}

function blocked(reason: string, missingFields: string[]): FlyerSendResult {
  return {
    ok: false,
    status: 'blocked',
    reason,
    missingFields,
    evidenceStamp: null,
    record: null,
  };
}

function readSendRecords(): FlyerSendRecord[] {
  return readJsonl<FlyerSendRecord>(sendLogPath());
}

function readOptOuts(): string[] {
  const path = optOutPath();
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf-8')) as string[];
}

function recordOptOut(contact: string): void {
  const normalized = contact.toLowerCase();
  const optOuts = new Set(readOptOuts());
  optOuts.add(normalized);
  writeFileEnsured(optOutPath(), JSON.stringify([...optOuts].sort(), null, 2));
}

function isOptedOut(contact: string): boolean {
  return readOptOuts().includes(contact.toLowerCase());
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    });
}

function appendJsonl(path: string, record: object): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`, { encoding: 'utf-8' });
}

function writeFileEnsured(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function stateDir(): string {
  return process.env['VYRDEN_FLYER_STATE_DIR']?.trim() || join(process.cwd(), 'state', 'vyrden-flyer');
}

function sendLogPath(): string {
  return join(stateDir(), 'sends.jsonl');
}

function outboxPath(): string {
  return join(stateDir(), 'email-outbox.jsonl');
}

function optOutPath(): string {
  return join(stateDir(), 'opt-outs.json');
}

function dedupeKey(value: Pick<FlyerPilotContact, 'pilotId' | 'contact' | 'assetVersion'>): string {
  return `${value.pilotId}:${value.contact.toLowerCase()}:${value.assetVersion}`;
}

function withinMs(timestamp: string, now: Date, windowMs: number): boolean {
  return now.getTime() - new Date(timestamp).getTime() < windowMs;
}

function buildEvidenceStamp(payload: Record<string, unknown>): string {
  const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24);
  return `evd_flyer_${digest}`;
}
