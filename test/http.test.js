import { test, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'eventsphere-test-key-not-for-production-12345';
const { default: app } = await import('../src/app.js');
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));

test('health endpoint reports unavailable database without leaking configuration', async () => {
  const result = await fetch(base + '/health');
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { status: 'database-unavailable' });
  assert.equal(result.headers.get('x-powered-by'), null);
});

test('protected routes reject unauthenticated requests', async () => {
  for (const path of ['/auth/me', '/auth/allusers', '/analytics/summary', '/attendees/all', '/exhibitors/all', '/notifications/mine', '/feedback/all', '/messages/conversations']) {
    const result = await fetch(base + path);
    assert.equal(result.status, 401, path);
  }
});

test('invalid public identifiers return validation errors', async () => {
  for (const path of ['/events/invalid', '/booths/event/invalid', '/booths/layout/invalid', '/sessions/event/invalid', '/exhibitor-files/invalid/logo']) {
    const result = await fetch(base + path);
    assert.equal(result.status, 400, path);
  }
});

test('malformed JSON is handled consistently', async () => {
  const result = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
  assert.equal(result.status, 400);
  assert.equal((await result.json()).msg, 'Invalid JSON request');
});
