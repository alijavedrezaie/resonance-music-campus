/* Fixed-purpose relay. Only the existing, active campus owner can use it. */
const PROVIDER = 'https://magic-chords.dev/api/v1';
const CAMPUS_ORIGIN = 'https://alijavedrezaie.github.io';
const JOB = /^[A-Za-z0-9_-]{8,100}$/;
export function createHandler({ env, fetcher = fetch }) {
  return async function handle(request) {
    const origin = request.headers.get('origin');
    const headers = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
      'Access-Control-Allow-Origin': CAMPUS_ORIGIN,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (origin && origin !== CAMPUS_ORIGIN) return reply(403, { error: 'Use Guitar tools inside your campus.' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
    const token = request.headers.get('authorization');
    if (!/^Bearer \S+$/.test(token || '')) return reply(401, { error: 'Sign in to your campus.' });
    const supabaseUrl = env('SUPABASE_URL');
    const anonKey = env('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !anonKey) return reply(503, { error: 'The campus analysis connection needs configuration.' });
    try {
      const owner = await fetcher(`${supabaseUrl}/rest/v1/rpc/campus_is_owner`, {
        method: 'POST', headers: { Authorization: token, apikey: anonKey, 'Content-Type': 'application/json' },
        body: '{}', signal: AbortSignal.timeout(5000),
      });
      if (!owner.ok || await owner.json() !== true) return reply(owner.status === 401 ? 401 : 403, { error: 'Sign in with the active campus owner account.' });
      if (Number(request.headers.get('content-length')) > 4096) return reply(413, { error: 'Request too large.' });
      const text = await request.text();
      if (text.length > 4096) return reply(413, { error: 'Request too large.' });
      let body;
      try { body = JSON.parse(text); } catch { return reply(400, { error: 'Send a valid JSON request.' }); }
      if (!body || typeof body !== 'object') return reply(400, { error: 'Invalid request.' });
      let endpoint, options;
      if (body.action === 'submit') {
        if (!/^[A-Za-z0-9_-]{11}$/.test(body.videoId || '')) return reply(400, { error: 'Invalid YouTube video.' });
        endpoint = '/analyze/url';
        options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${body.videoId}`, beat_tracking: true }) };
      } else if (['status', 'result'].includes(body.action) && JOB.test(body.jobId || '')) {
        endpoint = `/jobs/${body.jobId}${body.action === 'result' ? '/result' : ''}`;
        options = { method: 'GET' };
      } else return reply(400, { error: 'Invalid analysis action or job.' });
      const upstream = await fetcher(PROVIDER + endpoint, { ...options, redirect: 'error', signal: AbortSignal.timeout(8000) });
      if (!upstream.ok) {
        const message = upstream.status === 429 ? 'The analysis service is busy or its free quota is reached. Try again later.' : upstream.status === 404 ? 'This analysis has expired. Paste the YouTube link again.' : 'The analysis service could not process this request. Try again later.';
        if (upstream.headers.has('retry-after')) headers['Retry-After'] = upstream.headers.get('retry-after');
        return reply(upstream.status === 429 ? 429 : 502, { error: message });
      }
      const data = await upstream.json();
      if (body.action === 'result') {
        // Return musical results only. Provider file paths/audio URLs stay server-side.
        return reply(200, {
          segments: Array.isArray(data.segments) ? data.segments.slice(0, 2000).map(s => ({ label: s.label, start: s.start, end: s.end, confidence: s.confidence })) : [],
          tempo: data.tempo, key: data.key, time_signature: data.time_signature, duration: data.duration,
          powered_by: 'Magic Chords (https://magic-chords.dev)',
        });
      }
      return reply(200, {
        job_id: data.job_id, status: data.status,
        error_key: data.error_key,
        message: data.status === 'error' ? 'This video could not be accessed or analyzed. Try another public YouTube video.' : undefined,
        powered_by: 'Magic Chords (https://magic-chords.dev)',
      });
    } catch (error) {
      return reply(502, { error: error?.name === 'TimeoutError' ? 'The analysis service timed out. Please retry.' : 'Could not reach the analysis service. Please retry.' });
    }
  };
}
