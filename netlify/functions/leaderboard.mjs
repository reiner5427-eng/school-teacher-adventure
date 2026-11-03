import { getDatabase } from '@netlify/database';

export const config = { path: '/api/leaderboard' };
const respond = (data, status = 200, headers = {}) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', ...headers }
});

export default async function leaderboard(request) {
  if (!['GET', 'POST'].includes(request.method)) {
    return respond({error:'method'}, 405, {Allow:'GET, POST'});
  }
  let record;
  if (request.method === 'POST') {
    if (request.headers.get('origin') !== new URL(request.url).origin) return respond({error:'origin'}, 403);
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return respond({error:'format'}, 415);
    try {
      const raw = await request.text();
      if (raw.length > 1024) return respond({error:'size'}, 413);
      record = JSON.parse(raw);
    } catch {
      return respond({error:'format'}, 400);
    }
    const name = typeof record?.name === 'string' ? record.name.normalize('NFC').trim() : '';
    const score = record?.score;
    const runId = record?.runId;
    if (!/^[\p{L}\p{N} _-]{1,16}$/u.test(name) || !Number.isInteger(score) ||
        score < 0 || score > 33000 || score % 20 !== 0 ||
        typeof runId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(runId)) {
      return respond({error:'record'}, 400);
    }
    record = {name, score, runId};
  }
  try {
    const {sql} = getDatabase();
    let rank;
    if (record) {
      await sql`INSERT INTO leaderboard (run_id, name, score, course)
        VALUES (${record.runId}, ${record.name}, ${record.score}, 2)
        ON CONFLICT (run_id) DO NOTHING`;
      const [saved] = await sql`SELECT name, score, (
        SELECT count(*)::integer + 1 FROM leaderboard AS rival
        WHERE rival.course = 2 AND (rival.score > own.score OR (rival.score = own.score AND
          (rival.created_at, rival.run_id) < (own.created_at, own.run_id)))
      ) AS rank FROM leaderboard AS own WHERE course = 2 AND run_id = ${record.runId}`;
      if (!saved || saved.name !== record.name || saved.score !== record.score) return respond({error:'conflict'}, 409);
      rank = saved.rank;
    }
    const rows = await sql`SELECT name, score FROM leaderboard
      WHERE course = 2 ORDER BY score DESC, created_at, run_id LIMIT 20`;
    return respond({rows, rank}, record ? 201 : 200);
  } catch (error) {
    console.error('Leaderboard storage error', error.code ?? error.name);
    return respond({error:'storage'}, 503);
  }
}


