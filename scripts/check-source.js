import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', 'backups'].includes(entry.name)) continue;
    const file = join(directory, entry.name);
    if (entry.isDirectory()) check(file);
    else if (file.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status !== 0) { process.stderr.write(result.stderr); process.exitCode = 1; }
    }
  }
}
check('.');
