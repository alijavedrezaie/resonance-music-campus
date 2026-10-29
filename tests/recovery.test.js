const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBackend } = require('../js/backend.js');
function fixture({ owner = true, expired = false } = {}) {
  const calls = [], stored = new Map();
  const backend = createBackend({
    config: { backend: 'supabase', url: 'https://test.supabase.co', publishableKey: 'sb_publishable_test_only_not_real' },
    pageUrl: 'https://example.github.io/campus/reset-password.html',
    storage: {getItem: k => stored.get(k), setItem: (k,v) => stored.set(k,v), removeItem: k => stored.delete(k)},
    validateState: x => x,
    fetch: async (url, options) => {
      calls.push({url, ...options});
      const status = expired && url.endsWith('/user') ? 401 : 200;
      return { status, ok: status === 200, json: async () => url.endsWith('/campus_is_owner') ? owner : {message: 'expired'} };
    },
  });
  return {backend,calls,stored};
}
test('recovery uses the fixed campus redirect and never persists link credentials', async () => {
  const {backend,calls,stored} = fixture();
  await backend.request('/api/recovery/request','POST',{email:' owner@example.test '});
  assert.equal(new URL(calls[0].url).searchParams.get('redirect_to'),'https://example.github.io/campus/reset-password.html');
  assert.deepEqual(JSON.parse(calls[0].body),{email:'owner@example.test'});
  await backend.request('/api/recovery/verify','POST',{type:'recovery',accessToken:'test-recovery-token'});
  assert.equal(stored.size,0);
  await backend.request('/api/recovery/password','POST',{password:'test-only-new-password'});
  assert.ok(calls.some(c=>c.method==='PUT' && c.headers.Authorization==='Bearer test-recovery-token'));
  assert.ok(calls.some(c=>c.url.endsWith('/logout?scope=global')));
  await assert.rejects(backend.request('/api/recovery/password','POST',{password:'another-test-password'}),/fresh password reset/);
});
test('password changes reject missing, expired, non-owner, and wrong-type recovery credentials', async () => {
  for (const options of [{},{expired:true},{owner:false}]) {
    const {backend,calls} = fixture(options);
    await assert.rejects(backend.request('/api/recovery/password','POST',{password:'test-only-new-password'}));
    if (options.expired || options.owner === false)
      await assert.rejects(backend.request('/api/recovery/verify','POST',{type:'recovery',accessToken:'test-token'}));
    await assert.rejects(backend.request('/api/recovery/verify','POST',{type:'magiclink',accessToken:'test-token'}));
    assert.equal(calls.some(c=>c.method==='PUT'),false);
  }
});
test('verified recovery rejects short passwords without updating the account', async () => {
  const {backend,calls} = fixture();
  await backend.request('/api/recovery/verify','POST',{type:'recovery',accessToken:'test-token'});
  await assert.rejects(backend.request('/api/recovery/password','POST',{password:'short'}),/15 and 128/);
  assert.equal(calls.some(c=>c.method==='PUT'),false);
});
