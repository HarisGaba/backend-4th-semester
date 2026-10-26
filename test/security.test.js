import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
process.env.JWT_SECRET = 'eventsphere-test-key-not-for-production-12345';
process.env.NODE_ENV = 'test';
const { authenticate, authorize, createToken } = await import('../src/middleware/authmiddleware.js');
const { Register, Login } = await import('../src/controllers/authcontroller.js');
const { saveFloorPlan } = await import('../src/controllers/floorplancontroller.js');
const { createEvent } = await import('../src/controllers/eventcontroller.js');
const { default: User } = await import('../src/models/authmodel.js');
const { default: Event } = await import('../src/models/eventmodel.js');
const id = '507f1f77bcf86cd799439011';
const other = '507f1f77bcf86cd799439012';
function response() { return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
afterEach(() => mock.restoreAll());

test('JWT includes expiry, issuer, audience and token version', () => {
  const payload = jwt.verify(createToken({ _id: id, tokenVersion: 3 }), process.env.JWT_SECRET);
  assert.equal(payload.sub, id);
  assert.equal(payload.version, 3);
  assert.equal(payload.iss, 'eventsphere-api');
  assert.equal(payload.aud, 'eventsphere-web');
  assert.equal(payload.exp - payload.iat, 3600);
});

test('missing and invalid bearer tokens are rejected before database access', async () => {
  for (const value of ['', 'Basic abc', 'Bearer invalid', 'Bearer a b']) {
    const res = response();
    await authenticate({ get: () => value }, res, () => assert.fail('Unexpected access'));
    assert.equal(res.code, 401);
  }
});

test('changed token version invalidates an old login', async () => {
  const token = createToken({ _id: id, tokenVersion: 0 });
  mock.method(User, 'findById', async () => ({ _id: id, tokenVersion: 1 }));
  const res = response();
  await authenticate({ get: () => 'Bearer ' + token }, res, () => assert.fail('Unexpected access'));
  assert.equal(res.code, 401);
});

test('valid login uses the database role instead of a client role', async () => {
  const token = createToken({ _id: id, tokenVersion: 0 });
  mock.method(User, 'findById', async () => ({ _id: id, tokenVersion: 0, role: 'attendee' }));
  const req = { get: () => 'Bearer ' + token, body: { role: 'admin' } };
  let called = false;
  await authenticate(req, response(), () => { called = true; });
  assert.equal(called, true);
  assert.equal(req.user.role, 'attendee');
});

for (const role of ['attendee', 'exhibitor', 'organizer', 'admin']) {
  test('organizer permission boundary for ' + role, () => {
    const res = response(); let allowed = false;
    authorize('admin', 'organizer')({ user: { role } }, res, () => { allowed = true; });
    assert.equal(allowed, ['admin', 'organizer'].includes(role));
    if (!allowed) assert.equal(res.code, 403);
  });
}

test('public signup cannot create an administrator', async () => {
  const res = response();
  await Register({ body: { name: 'Example User', email: 'example@example.test', password: 'example-password', role: 'admin' } }, res);
  assert.equal(res.code, 400);
});

test('registration rejects short names and passwords', async () => {
  for (const body of [{ name: 'A' }, { name: 'Example User', email: 'example@example.test', password: 'short' }]) {
    const res = response(); await Register({ body }, res); assert.equal(res.code, 400);
  }
});

test('login rejects non-string credentials', async () => {
  const res = response(); await Login({ body: { email: { $ne: null }, password: 'password' } }, res);
  assert.equal(res.code, 400);
});

test('event creation checks ownership', async () => {
  const { createBooth } = await import('../src/controllers/boothcontroller.js');
  mock.method(Event, 'findById', async () => ({ organizer: other }));
  const res = response();
  await createBooth({ user: { _id: id, role: 'organizer' }, body: { event: other, boothNumber: 'A1' } }, res);
  assert.equal(res.code, 403);
});

test('event creation rejects invalid dates before writing', async () => {
  const res = response();
  await createEvent({ user: { _id: id }, body: { title: 'Expo', description: 'Description', location: 'Karachi', category: 'Technology', date: 'not-a-date' } }, res);
  assert.equal(res.code, 400);
});

test('floor plan rejects overlapping placements', async () => {
  mock.method(Event, 'findById', async () => ({ _id: id, organizer: id }));
  const res = response();
  await saveFloorPlan({ params: { eventId: id }, user: { _id: id, role: 'organizer' }, body: {
    rows: 2, columns: 2, revision: 0,
    placements: [{ booth: id, row: 1, column: 1 }, { booth: other, row: 1, column: 1 }],
  } }, res);
  assert.equal(res.code, 400);
  assert.match(res.body.msg, /cannot be used twice/);
});

test('floor plan rejects out-of-range grids', async () => {
  const res = response();
  await saveFloorPlan({ params: { eventId: id }, body: { rows: 21, columns: 2, revision: 0, placements: [] } }, res);
  assert.equal(res.code, 400);
});
