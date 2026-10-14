/**
 * Spawn a process and stream its stdout/stderr as an async generator.
 */

import { spawn, spawnSync } from 'child_process'
import { StringDecoder } from 'string_decoder'
import { SandboxAbortError, SandboxTimeoutError } from './errors.js'
import type { ExecutionResult, StreamChunk } from './types.js'

const SIGNAL_CODES: Record<string, number> = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGQUIT: 3,
  SIGABRT: 6,
  SIGKILL: 9,
  SIGSEGV: 11,
  SIGPIPE: 13,
  SIGTERM: 15,
}

/**
 * Options for {@link streamProcess}.
 */
export interface StreamProcessOptions {
  /** Maximum execution time in seconds. */
  timeout?: number | undefined
  /** Abort signal to cancel execution. */
  signal?: AbortSignal | undefined
  /** Custom error message when the spawned binary is not found (ENOENT). */
  enoentMessage?: string | undefined
  /** Working directory for the process. */
  cwd?: string | undefined
  /** Environment variables added to the current process environment. */
  env?: Record<string, string> | undefined
  /** Bytes or text written to the process's standard input. */
  input?: Uint8Array | string | undefined
}

/**
 * Spawn a command and stream its stdout/stderr, yielding the final result.
 *
 * Bridges Node.js event emitters to an async generator. Chunks are
 * yielded incrementally as the process produces output. The final
 * yield is an ExecutionResult with the exit code and complete output.
 *
 * All listeners are attached synchronously before any await to prevent
 * missed events from fast-completing processes.
 *
 * @param command - The binary to spawn.
 * @param args - Arguments to pass to the binary.
 * @param options - Timeout, abort signal, and ENOENT handling options.
 * @returns An async generator yielding StreamChunks followed by a final ExecutionResult.
 */
export async function* streamProcess(
  command: string,
  args: string[],
  options?: StreamProcessOptions
): AsyncGenerator<StreamChunk | ExecutionResult, void, undefined> {
  const proc = spawn(command, args, {
    cwd: options?.cwd,
    env: options?.env ? { ...process.env, ...options.env } : undefined,
    stdio: [options?.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    windowsHide: true,
  })
  const stdoutDecoder = new StringDecoder('utf8')
  const stderrDecoder = new StringDecoder('utf8')
  const chunks: StreamChunk[] = []
  let stdout = ''
  let stderr = ''
  let done = false
  let terminating = false
  let exitCode = 0
  let error: Error | undefined
  let enoent = false
  let resolveWait: (() => void) | undefined
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  let killTimer: ReturnType<typeof setTimeout> | undefined

  const wake = (): void => {
    if (resolveWait) {
      resolveWait()
      resolveWait = undefined
    }
  }

  const terminate = (reason: Error): void => {
    if (terminating || done) return
    terminating = true
    error = reason
    signalProcessTree(proc.pid, 'SIGTERM')
    wake()
    killTimer = setTimeout(() => {
      if (!done) signalProcessTree(proc.pid, 'SIGKILL')
    }, 1000)
  }

  const appendOutput = (text: string, streamType: 'stdout' | 'stderr'): void => {
    if (!text) return
    if (streamType === 'stdout') {
      stdout += text
    } else {
      stderr += text
    }
    chunks.push({ type: 'streamChunk', data: text, streamType })
    wake()
  }

  proc.stdout?.on('data', (data: Uint8Array) => appendOutput(stdoutDecoder.write(data), 'stdout'))
  proc.stderr?.on('data', (data: Uint8Array) => appendOutput(stderrDecoder.write(data), 'stderr'))
  proc.stdout?.on('end', () => appendOutput(stdoutDecoder.end(), 'stdout'))
  proc.stderr?.on('end', () => appendOutput(stderrDecoder.end(), 'stderr'))

  proc.on('close', (code, signal) => {
    if (!done) {
      if (code !== null) {
        exitCode = code
      } else if (signal) {
        exitCode = 128 + (SIGNAL_CODES[signal] ?? 1)
      } else {
        exitCode = 1
      }
      done = true
      wake()
    }
  })

  proc.on('error', (err) => {
    if (!done) {
      if (options?.enoentMessage && 'code' in err && err.code === 'ENOENT') {
        enoent = true
      } else {
        error = err
      }
      done = true
      wake()
    }
  })

  if (options?.input !== undefined) {
    proc.stdin?.on('error', () => {})
    proc.stdin?.end(options.input)
  }

  const onAbort = (): void => terminate(new SandboxAbortError())

  if (options?.signal) {
    if (options.signal.aborted) {
      onAbort()
    } else {
      options.signal.addEventListener('abort', onAbort, { once: true })
    }
  }

  if (options?.timeout !== undefined) {
    timeoutHandle = setTimeout(() => {
      terminate(new SandboxTimeoutError(options.timeout!, stdout, stderr))
    }, options.timeout * 1000)
  }

  try {
    while (true) {
      if (chunks.length > 0) {
        const batch = chunks.splice(0, chunks.length)
        for (const chunk of batch) {
          yield chunk
        }
      }

      if (done) break

      await new Promise<void>((resolve) => {
        resolveWait = resolve
        setTimeout(resolve, 50)
      })
    }

    if (enoent) {
      yield {
        type: 'executionResult',
        exitCode: 127,
        stdout: '',
        stderr: options!.enoentMessage!,
        outputFiles: [],
      } satisfies ExecutionResult
      return
    }

    if (error) throw error

    yield {
      type: 'executionResult',
      exitCode,
      stdout,
      stderr,
      outputFiles: [],
    } satisfies ExecutionResult
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
    if (killTimer !== undefined) clearTimeout(killTimer)
    if (options?.signal) options.signal.removeEventListener('abort', onAbort)
    if (!done) signalProcessTree(proc.pid, 'SIGKILL')
  }
}

function signalProcessTree(pid: number | undefined, signal: 'SIGTERM' | 'SIGKILL'): void {
  if (pid === undefined) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    return
  }
  try {
    process.kill(-pid, signal)
  } catch {
    try {
      process.kill(pid, signal)
    } catch {
      // The process may have completed between the state check and the signal.
    }
  }
}
