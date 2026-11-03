import { getDatabase } from '@netlify/database';

export const config = { path: '/api/leaderboard' };
const respond = (data, status = 200, headers = {}) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', ...headers }
});

function blockedNickname(name) {
  const normalized = name.normalize('NFKC').toLowerCase();
  const compact = normalized.replace(/[^\p{L}\p{N}]/gu,'');
  const politicians = /이재명|윤석열|문재인|박근혜|이명박|노무현|김대중|김영삼|노태우|전두환|최규하|박정희|윤보선|이승만|한동훈|이준석|안철수|홍준표|나경원|유승민|오세훈|김문수|정청래|우원식|장동혁|한덕수|이낙연|황교안|심상정|추미애|원희룡|김부겸|박지원|김민석|권성동|주호영|김기현|김동연|박용진|이탄희|박주민|정점식|김도읍|배현진|장혜영|용혜인|허경영/u;
  const ilbe = /일베|일간베스트|일밍아웃|ilbe|1lbe|운지천|노알라|노무딱|노무노무|슨상님|좌좀|홍어족|절라디언|전라디언|삼일한|3일한|김치녀|된장녀|맘충|틀딱|한남충|급식충/u;
  if (politicians.test(compact) || ilbe.test(compact) ||
      /^(?:조국|운지|홍어|슨상)(?:쌤|선생님|좌|\d+)?$/u.test(compact)) return true;
  const korean = /씨발|시발|씨빨|시빨|씹|개새끼|개색기|병신|미친놈|미친년|좆|존나|지랄|꺼져|섹스|쎅스|야동|포르노|자위|보지|자지|딸딸이|성기|ㅅㅂ|ㅂㅅ/u;
  const english = /fuck|fuk|fck|bitch|b1tch|whore|slut|cunt|dick|cock|pussy|porn|hentai|boobs|sexx|s3x/u;
  return korean.test(compact) || korean.test(name) || english.test(compact) ||
    /(?:^|[^\p{L}\p{N}])(?:sex|shit|asshole|xxx)(?:$|[^\p{L}\p{N}])/u.test(normalized) ||
    /^(?:sex|shit|asshole|xxx)\d*$/u.test(compact);
}

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
    if (blockedNickname(name)) return respond({error:'nickname'}, 422);
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


