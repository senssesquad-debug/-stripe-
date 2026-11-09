import { CITIES, getCategory, localDate, localToUtc, normalizeZone } from '@passtra/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { integrationStatus } from '../config';
import { tx } from '../db';
import { applyManualFields, ingestEvent, mergeEntities } from '../engine/merge';
import { runSource } from '../engine/pipeline';
import { completeSchedule, loadSource } from '../engine/scheduler';
import type { NormalizedEvent } from '../engine/types';
import { ApiError, parse, requireRole } from '../http';
import { eventToDTO, getEventRow, getPlaceRow, placeToDTO, provenance } from '../repo/entities';

const Uuid = z.string().uuid();
const Type = z.enum(['event', 'place']);
const Page = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50), offset: z.coerce.number().int().min(0).default(0) });

export async function adminRoutes(app: FastifyInstance, deps: AppDeps) {
  const { db } = deps;
  const staff = (req: FastifyRequest) => requireRole(req, 'admin', 'moderator');
  const adminOnly = (req: FastifyRequest) => requireRole(req, 'admin');
  const audit = (actor: string, action: string, entityType: string | null, entityId: string | null, before: unknown, after: unknown) =>
    db.query('INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, before, after) VALUES ($1,$2,$3,$4,$5,$6)', [actor, action, entityType, entityId, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null]);

  app.get('/v1/admin/stats', async (req) => {
    staff(req);
    const one = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0]?.n ?? 0);
    const [events, upcoming, places, conflicts, dupes, reports, submissions, unverified, errors24h, users, pendingReviews] = await Promise.all([
      one(`SELECT COUNT(*) AS n FROM events WHERE merged_into IS NULL AND archived_at IS NULL`),
      one(`SELECT COUNT(*) AS n FROM events WHERE merged_into IS NULL AND status IN ('scheduled','rescheduled') AND starts_at > now() - interval '1 day'`),
      one(`SELECT COUNT(*) AS n FROM places WHERE merged_into IS NULL AND status = 'active'`),
      one(`SELECT COUNT(*) AS n FROM data_conflicts WHERE status = 'open'`),
      one(`SELECT COUNT(*) AS n FROM duplicate_candidates WHERE status = 'pending'`),
      one(`SELECT COUNT(*) AS n FROM reports WHERE status = 'open'`),
      one(`SELECT COUNT(*) AS n FROM event_submissions WHERE status = 'pending'`),
      one(`SELECT COUNT(*) AS n FROM events WHERE merged_into IS NULL AND status IN ('scheduled','rescheduled') AND starts_at > now() AND verification_status IN ('unverified','conflicting')`),
      one(`SELECT COUNT(*) AS n FROM ingestion_errors WHERE created_at > now() - interval '24 hours'`),
      one(`SELECT COUNT(*) AS n FROM users`),
      one(`SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'`),
    ]);
    const byStatus = await db.query(`SELECT verification_status, COUNT(*)::int AS n FROM events WHERE merged_into IS NULL AND status IN ('scheduled','rescheduled') AND starts_at > now() - interval '1 day' GROUP BY 1`);
    const byCategory = await db.query(`SELECT primary_category AS category, COUNT(*)::int AS n FROM places WHERE merged_into IS NULL AND status = 'active' GROUP BY 1 ORDER BY 2 DESC LIMIT 25`);
    const runs = await db.query(`SELECT date_trunc('hour', started_at) AS hour, SUM(created)::int AS created, SUM(updated)::int AS updated, SUM(errors)::int AS errors FROM ingestion_runs WHERE started_at > now() - interval '48 hours' GROUP BY 1 ORDER BY 1`);
    return {
      totals: { events, upcomingEvents: upcoming, places, openConflicts: conflicts, pendingDuplicates: dupes, openReports: reports, pendingSubmissions: submissions, needsReview: unverified, ingestionErrors24h: errors24h, users, pendingReviews },
      eventsByVerification: byStatus.rows, placesByCategory: byCategory.rows, ingestionByHour: runs.rows, integrations: integrationStatus(deps.config),
    };
  });

  // ── Sources ──
  app.get('/v1/admin/sources', async (req) => {
    staff(req);
    const r = await db.query(
      `SELECT s.id, s.key, s.name, s.connector, s.entity_type, s.homepage_url, s.terms_url, s.terms_reviewed_at, s.terms_notes, s.attribution,
              s.authority::float8 AS authority, s.is_official, s.requires_key, s.config, s.enabled, s.min_interval_s, s.max_interval_s, s.current_interval_s,
              s.next_run_at, s.last_run_at, s.last_success_at, s.consecutive_failures,
              (SELECT COUNT(*)::int FROM source_records sr WHERE sr.source_id = s.id) AS records,
              (SELECT row_to_json(x) FROM (SELECT id, status, started_at, finished_at, fetched, created, updated, unchanged, merged, errors, missing, error_message FROM ingestion_runs WHERE source_id = s.id ORDER BY started_at DESC LIMIT 1) x) AS last_run
         FROM sources s ORDER BY s.entity_type, s.name`,
    );
    return { items: r.rows.map((s) => ({ ...s, keyConfigured: s.requires_key ? !!deps.config[s.requires_key as keyof typeof deps.config] : true })) };
  });

  app.patch('/v1/admin/sources/:id', async (req) => {
    const user = adminOnly(req);
    const { id } = parse(z.object({ id: z.coerce.number().int() }), req.params);
    const b = parse(z.object({
      enabled: z.boolean().optional(),
      authority: z.number().min(0).max(1).optional(),
      config: z.record(z.string(), z.unknown()).optional(),
      minIntervalS: z.number().int().min(300).optional(),
      maxIntervalS: z.number().int().min(300).optional(),
      termsReviewed: z.boolean().optional(),
      termsNotes: z.string().max(4000).optional(),
    }), req.body);
    const before = (await db.query('SELECT enabled, authority, config, min_interval_s, max_interval_s, terms_reviewed_at, terms_notes FROM sources WHERE id = $1', [id])).rows[0];
    if (!before) throw new ApiError(404, 'not_found', 'Source not found');
    try {
      await db.query(
        `UPDATE sources SET enabled = COALESCE($2, enabled), authority = COALESCE($3, authority), config = COALESCE($4, config),
           min_interval_s = COALESCE($5, min_interval_s), max_interval_s = COALESCE($6, max_interval_s),
           terms_reviewed_at = CASE WHEN $7::boolean IS NULL THEN terms_reviewed_at WHEN $7 THEN now() ELSE NULL END,
           terms_notes = COALESCE($8, terms_notes), next_run_at = CASE WHEN $2 = true THEN now() ELSE next_run_at END, updated_at = now()
         WHERE id = $1`,
        [id, b.enabled ?? null, b.authority ?? null, b.config ? JSON.stringify(b.config) : null, b.minIntervalS ?? null, b.maxIntervalS ?? null, b.termsReviewed ?? null, b.termsNotes ?? null],
      );
    } catch (e) {
      if ((e as { code?: string }).code === '23514') throw new ApiError(400, 'terms_review_required', 'Record a terms-of-use review before enabling a website source.');
      throw e;
    }
    await audit(user.id, 'source.update', 'source', String(id), before, b);
    return { ok: true };
  });

  app.post('/v1/admin/sources/:id/run', async (req, reply) => {
    const user = adminOnly(req);
    const { id } = parse(z.object({ id: z.coerce.number().int() }), req.params);
    const key = (await db.query<{ key: string }>('SELECT key FROM sources WHERE id = $1', [id])).rows[0]?.key;
    if (!key) throw new ApiError(404, 'not_found', 'Source not found');
    const source = (await loadSource(db, key))!;
    if (source.connector === 'manual') throw new ApiError(400, 'not_runnable', 'Manual sources are not fetched');
    await audit(user.id, 'source.run', 'source', String(id), null, null);
    // Runs can take minutes: respond immediately, the run shows up in /admin/runs.
    void runSource(deps.engine, source, 'manual').then((s) => completeSchedule(db, source, s)).catch((e) => req.log.error({ err: (e as Error).message }, 'manual run failed'));
    return reply.status(202).send({ started: true });
  });

  app.get('/v1/admin/runs', async (req) => {
    staff(req);
    const q = parse(Page.extend({ source: z.coerce.number().int().optional() }), req.query);
    const r = await db.query(
      `SELECT r.*, s.key AS source_key, s.name AS source_name FROM ingestion_runs r JOIN sources s ON s.id = r.source_id
        WHERE ($1::int IS NULL OR r.source_id = $1) ORDER BY r.started_at DESC LIMIT $2 OFFSET $3`, [q.source ?? null, q.limit, q.offset]);
    return { items: r.rows };
  });

  app.get('/v1/admin/errors', async (req) => {
    staff(req);
    const q = parse(Page.extend({ source: z.coerce.number().int().optional() }), req.query);
    const r = await db.query(
      `SELECT e.id, e.run_id, e.external_id, e.stage, e.message, e.sample, e.created_at, s.key AS source_key FROM ingestion_errors e JOIN sources s ON s.id = e.source_id
        WHERE ($1::int IS NULL OR e.source_id = $1) ORDER BY e.created_at DESC LIMIT $2 OFFSET $3`, [q.source ?? null, q.limit, q.offset]);
    return { items: r.rows };
  });

  // ── Review queue: upcoming events with weak or conflicting data ──
  app.get('/v1/admin/review/events', async (req) => {
    staff(req);
    const q = parse(Page.extend({ status: z.enum(['unverified', 'likely', 'conflicting', 'all']).default('all') }), req.query);
    const r = await db.query<{ id: string }>(
      `SELECT id FROM events WHERE merged_into IS NULL AND status IN ('scheduled','rescheduled','unlisted','postponed') AND starts_at > now() - interval '1 day'
          AND (CASE WHEN $1 = 'all' THEN verification_status IN ('unverified','conflicting') OR time_unconfirmed OR location_precision IN ('city','unknown') ELSE verification_status = $1 END)
        ORDER BY starts_at LIMIT $2 OFFSET $3`, [q.status, q.limit, q.offset]);
    const items = [];
    for (const { id } of r.rows) {
      const row = await getEventRow(db, id, null);
      if (row) items.push(eventToDTO(row, 'en', new Date(), await provenance(db, 'event', id)));
    }
    return { items };
  });

  app.get('/v1/admin/:type/:id', async (req) => {
    staff(req);
    const p = parse(z.object({ type: z.enum(['events', 'places']), id: Uuid }), req.params);
    const type = p.type === 'events' ? 'event' : 'place';
    const row = type === 'event' ? await getEventRow(db, p.id, null) : await getPlaceRow(db, p.id, null);
    if (!row) throw new ApiError(404, 'not_found', 'Not found');
    const prov = await provenance(db, type, p.id);
    const obs = await db.query(`SELECT o.field, o.value, s.key AS source, s.authority::float8 AS authority, o.observed_at, o.last_seen_at FROM field_observations o JOIN sources s ON s.id = o.source_id WHERE o.entity_type = $1 AND o.entity_id = $2 ORDER BY o.field, s.authority DESC`, [type, p.id]);
    const records = await db.query(`SELECT sr.id, s.key AS source, sr.external_id, sr.url, sr.first_seen_at, sr.last_seen_at, sr.last_changed_at, sr.missing_runs, sr.normalized FROM source_records sr JOIN sources s ON s.id = sr.source_id WHERE sr.entity_type = $1 AND sr.entity_id = $2`, [type, p.id]);
    const entity = type === 'event' ? eventToDTO(row as never, 'en', new Date(), prov) : placeToDTO(row as never, 'en', new Date(), prov);
    return { entity, observations: obs.rows, records: records.rows };
  });

  // Manual correction: writes moderator values (locked until cleared) and recomputes.
  const EditableEvent = z.object({
    title: z.string().min(2).max(200), description: z.string().max(4000).nullable(), primary_category: z.string().refine((s) => !!getCategory(s)),
    venue_name: z.string().max(200).nullable(), address: z.string().max(300).nullable(), starts_at: z.string().datetime({ offset: true }).nullable(),
    ends_at: z.string().datetime({ offset: true }).nullable(), local_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), local_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    is_free: z.boolean().nullable(), price_min: z.number().min(0).nullable(), price_max: z.number().min(0).nullable(), currency: z.string().length(3).nullable(),
    ticket_url: z.string().url().nullable(), website: z.string().url().nullable(), organizer_name: z.string().max(200).nullable(),
    status: z.enum(['scheduled', 'cancelled', 'postponed', 'rescheduled']), location: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  }).partial();
  const EditablePlace = z.object({
    name: z.string().min(1).max(200), description: z.string().max(4000).nullable(), address: z.string().max(300).nullable(), phone: z.string().max(40).nullable(),
    website: z.string().url().nullable(), opening_hours: z.object({ format: z.literal('osm'), value: z.string().max(500) }).nullable(), is_free: z.boolean().nullable(),
    status: z.enum(['active', 'temporarily_closed', 'permanently_closed', 'hidden']), location: z.object({ lat: z.number(), lng: z.number() }),
  }).partial();

  app.patch('/v1/admin/:type/:id', async (req) => {
    const user = staff(req);
    const p = parse(z.object({ type: z.enum(['events', 'places']), id: Uuid }), req.params);
    const type = p.type === 'events' ? 'event' : 'place';
    const fields = type === 'event' ? parse(EditableEvent, req.body) : parse(EditablePlace, req.body);
    if (type === 'event' && 'location' in fields && fields.location) Object.assign(fields, { location_precision: 'exact' });
    await tx(db, (c) => applyManualFields(c, type, p.id, fields, new Date()));
    await audit(user.id, `${type}.edit`, type, p.id, null, fields);
    return { ok: true };
  });

  app.delete('/v1/admin/:type/:id/overrides/:field', async (req) => {
    const user = staff(req);
    const p = parse(z.object({ type: z.enum(['events', 'places']), id: Uuid, field: z.string().max(40) }), req.params);
    const type = p.type === 'events' ? 'event' : 'place';
    await db.query(`DELETE FROM field_observations o USING sources s WHERE s.id = o.source_id AND s.key LIKE 'passtra_admin%' AND o.entity_type = $1 AND o.entity_id = $2 AND o.field = $3`, [type, p.id, p.field]);
    await tx(db, (c) => applyManualFields(c, type, p.id, {}, new Date()));
    await audit(user.id, `${type}.override_cleared`, type, p.id, { field: p.field }, null);
    return { ok: true };
  });

  // ── Conflicts ──
  app.get('/v1/admin/conflicts', async (req) => {
    staff(req);
    const q = parse(Page.extend({ status: z.enum(['open', 'auto_resolved', 'resolved', 'dismissed']).default('open') }), req.query);
    const r = await db.query(
      `SELECT dc.*, COALESCE(e.title, p.name) AS entity_title, e.starts_at
         FROM data_conflicts dc LEFT JOIN events e ON dc.entity_type = 'event' AND e.id = dc.entity_id LEFT JOIN places p ON dc.entity_type = 'place' AND p.id = dc.entity_id
        WHERE dc.status = $1 ORDER BY dc.critical DESC, e.starts_at NULLS LAST, dc.updated_at DESC LIMIT $2 OFFSET $3`, [q.status, q.limit, q.offset]);
    return { items: r.rows };
  });

  app.post('/v1/admin/conflicts/:id/resolve', async (req) => {
    const user = staff(req);
    const { id } = parse(z.object({ id: z.coerce.number().int() }), req.params);
    const b = parse(z.object({ candidateIndex: z.number().int().min(0), note: z.string().max(1000).optional() }), req.body);
    const c = (await db.query<{ entity_type: 'event' | 'place'; entity_id: string; field: string; candidates: Array<{ value: unknown }> }>('SELECT entity_type, entity_id, field, candidates FROM data_conflicts WHERE id = $1', [id])).rows[0];
    if (!c) throw new ApiError(404, 'not_found', 'Conflict not found');
    const chosen = c.candidates[b.candidateIndex];
    if (!chosen) throw new ApiError(400, 'invalid_choice', 'No such candidate');
    await tx(db, async (client) => {
      await client.query(`UPDATE data_conflicts SET status = 'resolved', resolution = $2, resolved_by = $3, resolved_at = now(), updated_at = now() WHERE id = $1`, [id, JSON.stringify({ value: chosen.value, note: b.note ?? null }), user.id]);
      if (c.field === 'city') {
        // City conflicts: choosing the geocoded venue position locks it as the event location.
        const v = chosen.value as { lat?: number; lng?: number } | string;
        if (typeof v === 'object' && v && typeof v.lat === 'number') await applyManualFields(client, c.entity_type, c.entity_id, { location: v, location_precision: 'approximate' }, new Date());
        else await applyManualFields(client, c.entity_type, c.entity_id, {}, new Date());
      } else await applyManualFields(client, c.entity_type, c.entity_id, { [c.field]: chosen.value }, new Date());
    });
    await audit(user.id, 'conflict.resolve', c.entity_type, c.entity_id, c.candidates, chosen);
    return { ok: true };
  });

  app.post('/v1/admin/conflicts/:id/dismiss', async (req) => {
    const user = staff(req);
    const { id } = parse(z.object({ id: z.coerce.number().int() }), req.params);
    await db.query(`UPDATE data_conflicts SET status = 'dismissed', resolved_by = $2, resolved_at = now(), updated_at = now() WHERE id = $1`, [id, user.id]);
    await audit(user.id, 'conflict.dismiss', null, String(id), null, null);
    return { ok: true };
  });

  // ── Duplicates ──
  app.get('/v1/admin/duplicates', async (req) => {
    staff(req);
    const q = parse(Page.extend({ type: Type.optional() }), req.query);
    const r = await db.query(
      `SELECT d.*,
              COALESCE(ea.title, pa.name) AS a_title, COALESCE(eb.title, pb.name) AS b_title,
              ea.starts_at AS a_starts_at, eb.starts_at AS b_starts_at, COALESCE(ea.venue_name, pa.address) AS a_where, COALESCE(eb.venue_name, pb.address) AS b_where
         FROM duplicate_candidates d
         LEFT JOIN events ea ON d.entity_type = 'event' AND ea.id = d.a_id LEFT JOIN events eb ON d.entity_type = 'event' AND eb.id = d.b_id
         LEFT JOIN places pa ON d.entity_type = 'place' AND pa.id = d.a_id LEFT JOIN places pb ON d.entity_type = 'place' AND pb.id = d.b_id
        WHERE d.status = 'pending' AND ($1::text IS NULL OR d.entity_type = $1)
          AND COALESCE(ea.merged_into, pa.merged_into) IS NULL AND COALESCE(eb.merged_into, pb.merged_into) IS NULL
        ORDER BY d.score DESC LIMIT $2 OFFSET $3`, [q.type ?? null, q.limit, q.offset]);
    return { items: r.rows };
  });

  app.post('/v1/admin/duplicates/:id/merge', async (req) => {
    const user = staff(req);
    const { id } = parse(z.object({ id: z.coerce.number().int() }), req.params);
    const b = parse(z.object({ keep: z.enum(['a', 'b']) }), req.body);
    const d = (await db.query<{ entity_type: 'event' | 'place'; a_id: string; b_id: string }>('SELECT entity_type, a_id, b_id FROM duplicate_candidates WHERE id = $1', [id])).rows[0];
    if (!d) throw new ApiError(404, 'not_found', 'Not found');
    const [keep, drop] = b.keep === 'a' ? [d.a_id, d.b_id] : [d.b_id, d.a_id];
    await tx(db, (c) => mergeEntities(c, d.entity_type, keep, drop, new Date()));
    await audit(user.id, 'duplicate.merge', d.entity_type, keep, { dropped: drop }, null);
    return { ok: true, kept: keep };
  });

  app.post('/v1/admin/duplicates/:id/dismiss', async (req) => {
    const user = staff(req);
    const { id } = parse(z.object({ id: z.coerce.number().int() }), req.params);
    await db.query(`UPDATE duplicate_candidates SET status = 'dismissed', reviewed_by = $2, reviewed_at = now() WHERE id = $1`, [id, user.id]);
    return { ok: true };
  });

  // ── Reports ──
  app.get('/v1/admin/reports', async (req) => {
    staff(req);
    const q = parse(Page.extend({ status: z.enum(['open', 'accepted', 'rejected']).default('open') }), req.query);
    const r = await db.query(
      `SELECT r.id, r.entity_type, r.entity_id, r.kind, r.message, r.proposed, r.status, r.created_at, COALESCE(e.title, p.name) AS entity_title,
              (SELECT COUNT(*)::int FROM reports r2 WHERE r2.entity_id = r.entity_id AND r2.kind = r.kind AND r2.status = 'open') AS same_reports
         FROM reports r LEFT JOIN events e ON r.entity_type = 'event' AND e.id = r.entity_id LEFT JOIN places p ON r.entity_type = 'place' AND p.id = r.entity_id
        WHERE r.status = $1 ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`, [q.status, q.limit, q.offset]);
    return { items: r.rows };
  });

  app.post('/v1/admin/reports/:id/resolve', async (req) => {
    const user = staff(req);
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const b = parse(z.object({ action: z.enum(['accept', 'reject']), apply: z.boolean().default(false) }), req.body);
    const r = (await db.query<{ entity_type: 'event' | 'place'; entity_id: string; kind: string }>('SELECT entity_type, entity_id, kind FROM reports WHERE id = $1', [id])).rows[0];
    if (!r) throw new ApiError(404, 'not_found', 'Not found');
    await tx(db, async (c) => {
      await c.query(`UPDATE reports SET status = $2, reviewed_by = $3, reviewed_at = now() WHERE id = $1`, [id, b.action === 'accept' ? 'accepted' : 'rejected', user.id]);
      // Only explicit, verifiable facts are applied automatically; other corrections go through the edit form.
      if (b.action === 'accept' && b.apply) {
        if (r.entity_type === 'event' && r.kind === 'cancelled') await applyManualFields(c, 'event', r.entity_id, { status: 'cancelled' }, new Date());
        if (r.entity_type === 'place' && r.kind === 'closed') await applyManualFields(c, 'place', r.entity_id, { status: 'permanently_closed' }, new Date());
      }
    });
    await audit(user.id, `report.${b.action}`, r.entity_type, r.entity_id, null, { kind: r.kind, applied: b.apply });
    return { ok: true };
  });

  // ── Organiser submissions ──
  app.get('/v1/admin/submissions', async (req) => {
    staff(req);
    const q = parse(Page.extend({ status: z.enum(['pending', 'approved', 'rejected']).default('pending') }), req.query);
    const r = await db.query('SELECT id, payload, contact, status, event_id, review_notes, created_at FROM event_submissions WHERE status = $1 ORDER BY created_at LIMIT $2 OFFSET $3', [q.status, q.limit, q.offset]);
    return { items: r.rows };
  });

  app.post('/v1/admin/submissions/:id/approve', async (req) => {
    const user = staff(req);
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const s = (await db.query<{ payload: Record<string, string | number | boolean | undefined>; status: string }>('SELECT payload, status FROM event_submissions WHERE id = $1', [id])).rows[0];
    if (!s) throw new ApiError(404, 'not_found', 'Not found');
    if (s.status !== 'pending') throw new ApiError(409, 'already_reviewed', 'Submission already reviewed');
    const p = s.payload as { title: string; description?: string; category: string; venueName: string; address?: string; city: string; lat?: number; lng?: number; startDate: string; startTime?: string; endDate?: string; endTime?: string; isFree?: boolean; priceMin?: number; priceMax?: number; ticketUrl?: string; website?: string; organizer: string };
    const city = CITIES.find((c) => c.slug === p.city)!;
    const tz = normalizeZone(city.timezone);
    const exact = !!p.startTime;
    const startsAt = localToUtc(`${p.startDate} ${p.startTime ?? '00:00'}`, tz).utc;
    const endsAt = exact && p.endTime ? localToUtc(`${p.endDate ?? p.startDate} ${p.endTime}`, tz).utc : null;
    const source = (await loadSource(db, 'organizer_submissions'))!;
    const n: NormalizedEvent = {
      kind: 'event', externalId: id, title: p.title, description: p.description ?? null, categories: [p.category], sourceLabels: [], venueName: p.venueName,
      address: p.address ?? null, cityHint: city.name.en, location: p.lat !== undefined && p.lng !== undefined ? { lat: p.lat, lng: p.lng } : null,
      timezone: tz, startsAt, endsAt: endsAt && endsAt > startsAt ? endsAt : null, timePrecision: exact ? 'exact' : 'date_only',
      localStartDate: exact ? localDate(startsAt, tz) : p.startDate, localEndDate: p.endDate && p.endDate !== p.startDate ? p.endDate : null,
      price: p.isFree ? { isFree: true, min: 0, max: 0, currency: null, confident: true, text: '' } : p.priceMin !== undefined ? { isFree: false, min: p.priceMin, max: p.priceMax ?? p.priceMin, currency: 'EUR', confident: true, text: '' } : null,
      ticketUrl: p.ticketUrl ?? null, website: p.website ?? null, organizerName: p.organizer, organizerUrl: p.website ?? null, ageMin: null, images: [],
      status: 'scheduled', sourceUrl: null, externalIds: { submission: id },
    };
    const eventId = await tx(db, async (c) => {
      await ingestEvent({ client: c, source, geocoder: deps.engine.geocoder, log: req.log, now: new Date() }, { payload: { submission: id } }, n);
      const ev = await c.query<{ id: string }>(`SELECT id FROM events WHERE external_ids @> $1::jsonb AND merged_into IS NULL`, [JSON.stringify({ submission: id })]);
      const eid = ev.rows[0]!.id;
      await c.query('UPDATE events SET organizer_confirmed = true WHERE id = $1', [eid]);
      await c.query(`UPDATE event_submissions SET status = 'approved', event_id = $2, reviewer_id = $3, reviewed_at = now() WHERE id = $1`, [id, eid, user.id]);
      return eid;
    });
    await tx(db, (c) => applyManualFields(c, 'event', eventId, {}, new Date())); // recompute with organizer_confirmed
    await audit(user.id, 'submission.approve', 'event', eventId, null, { submission: id });
    return { ok: true, eventId };
  });

  app.post('/v1/admin/submissions/:id/reject', async (req) => {
    const user = staff(req);
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const b = parse(z.object({ notes: z.string().max(1000).optional() }), req.body ?? {});
    await db.query(`UPDATE event_submissions SET status = 'rejected', reviewer_id = $2, review_notes = $3, reviewed_at = now() WHERE id = $1 AND status = 'pending'`, [id, user.id, b.notes ?? null]);
    await audit(user.id, 'submission.reject', null, id, null, b);
    return { ok: true };
  });

  app.get('/v1/admin/audit', async (req) => {
    adminOnly(req);
    const q = parse(Page, req.query);
    return { items: (await db.query('SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2', [q.limit, q.offset])).rows };
  });
}
