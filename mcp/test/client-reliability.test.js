import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, assertApiOk } from '../src/client.js';
const response = (status, body = { code: 0, data: [] }) => ({ ok: status >= 200 && status < 300, status, headers: new Map(), text: async () => JSON.stringify(body) });
test('client retries one transient GET but never retries a write', async () => {
  let calls = 0;
  const c = createClient({ cookie: 'test', deviceId: 'device', retryBaseMs: 1, fetchImpl: async () => response(++calls === 1 ? 503 : 200) });
  assert.equal((await c.get('/api/test')).status, 200);
  assert.equal(calls, 2);
  calls = 0;
  assert.equal((await c.postForm('/api/write', {})).status, 503);
  assert.equal(calls, 1);
});
test('client bounds stalled requests and identifies uncertain writes', async () => {
  let calls = 0;
  const c = createClient({ cookie: 'secret-cookie', deviceId: 'secret-device', requestTimeoutMs: 10, maxReadRetries: 0, fetchImpl: async (url, options) => {
    calls++;
    return new Promise((resolve, reject) => options.signal?.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
  }});
  const keepAlive = setTimeout(() => {}, 200);
  try { await assert.rejects(c.postForm('/api/write', {}), e => e.uncertainWrite === true && !e.message.includes('secret-cookie')); } finally { clearTimeout(keepAlive); }
  assert.equal(calls, 1);
});
test('HTML login pages and non-envelope JSON cannot be successful API results', () => {
  assert.throws(() => assertApiOk({ok:true,status:200,json:null}, '/api/test'), /JSON|envelope|登录/i);
  assert.throws(() => assertApiOk({ok:true,status:200,json:{}}, '/api/test'), /JSON|envelope/i);
});
test('authenticated API client refuses external destinations and exposes only hashed account scope', async () => {
  let calls=0;
  const c=createClient({cookie:'secret-cookie',deviceId:'private-device',fetchImpl:async()=>{calls++;return response(200);}});
  await assert.rejects(c.get('https://example.invalid/leak'));
  assert.equal(calls,0);
  assert.equal(typeof c.accountKey,'function');
  assert.match(c.accountKey(),/^[a-f0-9]{64}$/);
  assert.ok(!c.accountKey().includes('secret'));
});
test('original upload may outlast API timeout while remaining cancellable', async () => {
  const {setTimeout: wait}=await import('node:timers/promises');
  const c=createClient({cookie:'test',deviceId:'device',requestTimeoutMs:10,uploadTimeoutMs:150,maxReadRetries:0,
    fetchImpl:async(url,{signal})=>{await wait(35,undefined,{signal});return response(200);}});
  assert.equal((await c.putBinary('https://upload.invalid/file',Buffer.from('original'),'omit')).status,200);
  await assert.rejects(c.postForm('/api/test',{}),e=>e.aborted&&e.uncertainWrite);
  await assert.rejects(c.withSignal(AbortSignal.timeout(10)).putBinary('https://upload.invalid/file',Buffer.from('original')),e=>e.aborted&&e.uncertainWrite);
});
