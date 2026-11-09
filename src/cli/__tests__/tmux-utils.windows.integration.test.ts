import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { delimiter, join } from 'path';
import { tmpdir } from 'os';
import { isTmuxAvailable, tmuxExec, tmuxSpawn } from '../tmux-utils.js';

const isWindows = process.platform === 'win32';

// Runs a real tmux.cmd wrapper through cmd.exe: the mocked tests in
// tmux-utils.test.ts check argv, not how cmd.exe parses the line it gets.
describe.skipIf(!isWindows)('tmux-utils native Windows integration', () => {
  let fixtureRoot: string | undefined;
  let originalPath: string | undefined;

  function installTmuxWrapper(prefix: string): void {
    fixtureRoot = mkdtempSync(join(tmpdir(), prefix));
    writeFileSync(
      join(fixtureRoot, 'tmux.cmd'),
      ['@echo off', 'if "%~1"=="-V" (echo tmux 3.4& exit /b 0)', 'echo args=[%*]', ''].join('\r\n'),
      'utf8',
    );
    process.env.PATH = `${fixtureRoot}${delimiter}${originalPath ?? ''}`;
  }

  beforeEach(() => {
    originalPath = process.env.PATH;
  });

  afterEach(() => {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    fixtureRoot = undefined;
  });

  it.each([
    ['with a space, like C:\\Program Files\\psmux', 'omc tmux wrapper '],
    ['without a space', 'omc-tmux-wrapper-'],
  ])('detects a tmux.cmd wrapper in a directory %s', (_label, prefix) => {
    installTmuxWrapper(prefix);

    expect(isTmuxAvailable()).toBe(true);
  });

  it('runs a tmux.cmd wrapper in a directory with a space and passes quoted args through', () => {
    installTmuxWrapper('omc tmux wrapper ');

    expect(tmuxExec(['-V']).trim()).toBe('tmux 3.4');
    expect(tmuxExec(['display-message', '-p', 'a b']).trim()).toBe('args=[display-message -p "a b"]');
    const spawned = tmuxSpawn(['send-keys', 'foo(bar)']);
    expect(spawned.status).toBe(0);
    expect(spawned.stdout.trim()).toBe('args=[send-keys "foo(bar)"]');
  });
});
