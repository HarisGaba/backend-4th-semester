import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'eventsphere-database-test-key-not-production';

test('database workflow across all four roles', { skip: process.env.RUN_DATABASE_TESTS !== '1', timeout: 120000 }, async (t) => {
  const databaseName = 'esaudit_' + randomUUID().replaceAll('-', '').slice(0, 24);
  const { default: app } = await import('../src/app.js');
  const { default: User } = await import('../src/models/authmodel.js');
  const { PDFDocument } = await import('pdf-lib');
  let server;
  console.log('Temporary test database: ' + databaseName);
  t.after(async () => {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    try {
      if (mongoose.connection.readyState === 1 && mongoose.connection.name === databaseName && /^esaudit_[a-f0-9]{24}$/.test(databaseName)) await mongoose.connection.dropDatabase({ maxTimeMS: 5000 });
    } finally { await mongoose.disconnect(); }
  });
  await mongoose.connect(process.env.MONGODB_URL, { dbName: databaseName, serverSelectionTimeoutMS: 10000 });
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(method, path, body, token, status = 200) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    assert.equal(res.status, status, method + ' ' + path + ': ' + JSON.stringify(data));
    return data;
  }
  const password = 'Audit-workflow-password-2026';
  const hashed = await bcrypt.hash(password, 12);
  for (const role of ['admin', 'organizer']) await User.create({ name: 'Audit ' + role, email: role + '@example.test', role, password: hashed });
  const accounts = {};
  for (const role of ['attendee', 'exhibitor']) accounts[role] = await request('POST', '/auth/register', { name: 'Audit ' + role, email: role + '@example.test', password, role }, null, 201);
  for (const role of ['admin', 'organizer']) accounts[role] = await request('POST', '/auth/login', { email: role + '@example.test', password });
  const token = role => accounts[role].token;
  const user = role => accounts[role].data || accounts[role].existingUser;
  await t.test('registration stores a hash and login returns the expected JWT shape', async () => {
    const record = await User.findById(user('attendee')._id).select('+password');
    assert.notEqual(record.password, password);
    assert.equal(await bcrypt.compare(password, record.password), true);
    const result = await request('POST', '/auth/login', { email: 'attendee@example.test', password });
    assert.equal(result.existingUser.role, 'attendee');
    await request('GET', '/analytics/summary', null, token('attendee'), 403);
  });
  let event, booth, application, session;
  await t.test('organizer creates an event while attendee creation is denied', async () => {
    const data = { title: 'Audit Expo', description: 'Isolated test event', category: 'Technology', location: 'Karachi', date: '2030-01-15' };
    await request('POST', '/events/create', data, token('attendee'), 403);
    event = (await request('POST', '/events/create', data, token('organizer'), 201)).event;
    assert.equal((await request('GET', '/events/all')).events.length, 1);
  });
  await t.test('exhibitor applies and organizer approves exactly once', async () => {
    application = (await request('POST', '/exhibitors/register', { event: event._id, companyName: 'Audit Company', category: 'Technology', description: 'Test exhibitor' }, token('exhibitor'), 201)).exhibitor;
    await request('PUT', '/exhibitors/status/' + application._id, { status: 'Approved' }, token('attendee'), 403);
    await request('PUT', '/exhibitors/status/' + application._id, { status: 'Approved' }, token('organizer'));
    await request('PUT', '/exhibitors/status/' + application._id, { status: 'Approved' }, token('organizer'), 409);
  });
  await t.test('profile search includes products and optional public contact information', async () => {
    await request('PUT', '/exhibitors/profile/' + application._id, { companyName: 'Audit Company', category: 'Technology', description: 'Test exhibitor', products: 'Robotics', contactEmail: 'contact@example.test' }, token('exhibitor'));
    const result = await request('GET', '/exhibitors/search?keyword=Robotics');
    assert.equal(result.exhibitors.length, 1);
    assert.equal(result.exhibitors[0].contactEmail, 'contact@example.test');
    assert.equal(result.exhibitors[0].staff, undefined);
  });
  await t.test('private exhibitor documents require owner or organizer permission', async () => {
    const pdf = await PDFDocument.create(); pdf.addPage();
    const form = new FormData(); form.append('file', new Blob([await pdf.save()], { type: 'application/pdf' }), 'audit.pdf');
    const response = await fetch(base + '/exhibitor-files/' + application._id + '/document', { method: 'POST', headers: { Authorization: 'Bearer ' + token('exhibitor') }, body: form });
    assert.equal(response.status, 200, await response.text());
    await request('GET', '/exhibitor-files/' + application._id + '/document', null, token('attendee'), 403);
    const download = await fetch(base + '/exhibitor-files/' + application._id + '/document', { headers: { Authorization: 'Bearer ' + token('organizer') } });
    assert.equal(download.status, 200);
    assert.match(download.headers.get('content-type'), /application\/pdf/);
    await download.arrayBuffer();
  });
  await t.test('approved exhibitor reserves one booth and duplicate reservation is rejected', async () => {
    booth = (await request('POST', '/booths/create', { event: event._id, boothNumber: 'A1' }, token('organizer'), 201)).booth;
    await request('POST', '/booths/reserve', { boothId: booth._id }, token('exhibitor'));
    await request('POST', '/booths/reserve', { boothId: booth._id }, token('exhibitor'), 409);
  });
  await t.test('floor plan saves positions and rejects stale revisions', async () => {
    const layout = { rows: 2, columns: 2, revision: 0, placements: [{ booth: booth._id, row: 1, column: 1 }] };
    await request('PUT', '/booths/layout/' + event._id, layout, token('organizer'));
    await request('PUT', '/booths/layout/' + event._id, layout, token('organizer'), 409);
    assert.equal((await request('GET', '/booths/layout/' + event._id)).layout.revision, 1);
  });
  await t.test('attendee registration and booth visit are reflected in analytics', async () => {
    await request('POST', '/attendees/register', { event: event._id }, token('attendee'), 201);
    await request('POST', '/attendees/register', { event: event._id }, token('attendee'), 409);
    await request('POST', '/booths/visit', { exhibitorId: application._id }, token('attendee'));
    const report = await request('GET', '/analytics/summary', null, token('organizer'));
    assert.equal(report.analytics.attendeeRegistrations, 1);
    assert.equal(report.analytics.recordedBoothVisits, 1);
  });
  await t.test('session registration, bookmarks and update notifications work together', async () => {
    const data = { event: event._id, title: 'Workshop', speaker: 'Speaker', topic: 'Robotics', location: 'Room 1', startTime: '2030-01-15T09:00:00Z', endTime: '2030-01-15T10:00:00Z' };
    session = (await request('POST', '/sessions/create', data, token('organizer'), 201)).session;
    await request('PUT', '/sessions/' + session._id + '/activity', { action: 'register', enabled: true }, token('attendee'));
    await request('PUT', '/sessions/' + session._id + '/activity', { action: 'bookmark', enabled: true }, token('attendee'));
    const report = await request('GET', '/analytics/summary', null, token('organizer'));
    assert.equal(report.analytics.sessionRegistrations, 1);
    assert.equal(report.analytics.sessionBookmarks, 1);
    await request('PUT', '/sessions/update/' + session._id, { ...data, location: 'Room 2' }, token('organizer'));
    assert.ok((await request('GET', '/notifications/mine', null, token('attendee'))).notifications.length);
  });
  await t.test('staff and booth services remain scoped to the exhibitor', async () => {
    await request('PUT', '/exhibitors/staff/' + application._id, { staff: [{ name: 'Audit Staff', duty: 'Reception' }] }, token('exhibitor'));
    await request('GET', '/exhibitors/staff/' + application._id, null, token('attendee'), 403);
    const service = (await request('POST', '/exhibitors/services/' + application._id, { service: 'Internet', details: 'Test service request' }, token('exhibitor'), 201)).request;
    await request('PUT', '/exhibitors/service-requests/' + service._id + '/status', { status: 'Approved', reply: 'Approved' }, token('organizer'));
  });
  await t.test('messages and support replies are accessible to their participants', async () => {
    const thread = '/messages/thread/' + event._id + '/' + user('attendee')._id;
    await request('POST', thread, { text: 'Where is the entrance?' }, token('attendee'), 201);
    await request('POST', thread, { text: 'Use the main entrance.' }, token('organizer'), 201);
    assert.equal((await request('GET', thread, null, token('attendee'))).messages.length, 2);
    await request('GET', thread, null, token('exhibitor'), 403);
    const feedback = (await request('POST', '/feedback/submit', { event: event._id, type: 'issue', message: 'Test support issue' }, token('attendee'), 201)).feedback;
    await request('PUT', '/feedback/update/' + feedback._id, { status: 'Resolved', reply: 'Resolved for test' }, token('organizer'));
  });
  await t.test('event deletion cannot orphan registrations', async () => {
    await request('DELETE', '/events/delete/' + event._id, null, token('organizer'), 409);
  });
  await t.test('one-time password reset invalidates the previous JWT', async () => {
    const reset = 'a'.repeat(64);
    await User.updateOne({ _id: user('attendee')._id }, { $set: { passwordResetToken: createHash('sha256').update(reset).digest('hex'), passwordResetExpires: new Date(Date.now() + 60000) } });
    await request('POST', '/forget/resetPassword', { token: reset, password: 'Updated-audit-password-2026' });
    await request('GET', '/auth/me', null, token('attendee'), 401);
    await request('POST', '/forget/resetPassword', { token: reset, password: 'Updated-again-password-2026' }, null, 400);
  });
});
