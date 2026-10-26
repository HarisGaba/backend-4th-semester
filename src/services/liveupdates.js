const subscribers = new Set();
const watchedPaths = ['/events', '/sessions', '/booths'];
export function subscribeToUpdates(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}
export function publishUpdate() {
  for (const listener of subscribers) listener();
}
export function announceChanges(req, res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && watchedPaths.some(path => req.path.startsWith(path + '/'))) {
    res.once('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) publishUpdate();
    });
  }
  next();
}
export function streamUpdates(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write('event: connected\ndata: {}\n\n');
  const unsubscribe = subscribeToUpdates(() => {
    if (!res.writableEnded && !res.destroyed && !res.write('event: changed\ndata: {}\n\n')) res.end();
  });
  const timer = setInterval(() => {
    if (!res.writableEnded) res.write(': keepalive\n\n');
  }, 25000);
  timer.unref();
  res.on('close', () => {
    clearInterval(timer);
    unsubscribe();
  });
}
