import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { subscribeToUpdates, announceChanges, streamUpdates } from '../src/services/liveupdates.js';

test('only successful event mutations notify subscribers', () => {
  let updates = 0;
  const unsubscribe = subscribeToUpdates(() => { updates++; });
  for (const [method, path, statusCode, expected] of [
    ['GET', '/events/all', 200, 0], ['POST', '/events/create', 400, 0],
    ['POST', '/auth/login', 200, 0], ['PUT', '/events/update/123', 200, 1],
    ['POST', '/booths/reserve', 200, 2], ['DELETE', '/sessions/delete/123', 200, 3],
  ]) {
    const res = new EventEmitter(); res.statusCode = statusCode;
    announceChanges({ method, path }, res, () => {});
    res.emit('finish'); assert.equal(updates, expected);
  }
  unsubscribe();
});

test('event stream contains no account or business data and closes cleanly', () => {
  const res = new EventEmitter(); let output = '';
  res.set = value => { res.headers = value; }; res.flushHeaders = () => {};
  res.write = value => { output += value; return true; };
  streamUpdates({}, res);
  assert.equal(res.headers['Content-Type'], 'text/event-stream');
  assert.equal(output, 'event: connected\ndata: {}\n\n');
  res.emit('close');
});
