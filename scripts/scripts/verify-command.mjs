import {spawnSync} from 'node:child_process';

// A timed-out, signaled, or unstarted command never counts as a pass.
export function runVerifyCommand(cmd, args, {timeout = 30000, stdio = 'inherit'} = {}) {
  const result = spawnSync(cmd, args, {stdio, timeout, killSignal: 'SIGKILL'});
  return {
    status: result.status === 0 && !result.error && !result.signal ? 'PASS' : 'FAIL',
    ...(result.error ? {reason: result.error.code || result.error.message} : {}),
    ...(result.signal ? {signal: result.signal} : {}),
    ...(result.status !== null ? {exitCode: result.status} : {}),
  };
}
