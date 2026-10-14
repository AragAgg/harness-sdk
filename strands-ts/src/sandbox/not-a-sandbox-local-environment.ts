import { randomUUID } from 'crypto'
import { readFile, writeFile, unlink, mkdir, readdir, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, isAbsolute, join, resolve } from 'path'
import { Sandbox } from './base.js'
import type { ExecuteOptions } from './base.js'
import { LANGUAGE_PATTERN } from './constants.js'
import { SandboxPathNotFoundError } from './errors.js'
import { streamProcess } from './stream-process.js'
import type { ExecutionResult, FileInfo, SandboxEnvironment, StreamChunk } from './types.js'
import { validateEnvKeys } from './posix-shell.js'

/** Returns true if the error is a missing entry (ENOENT) or a non-directory path component (ENOTDIR). */
function isMissingPathError(error: unknown): boolean {
  if (error === null || typeof error !== 'object' || !('code' in error)) {
    return false
  }
  return error.code === 'ENOENT' || error.code === 'ENOTDIR'
}

/**
 * Runs on the host with no isolation. Used as the default when no sandbox is configured.
 */
export class NotASandboxLocalEnvironment extends Sandbox {
  readonly cwd: string
  override readonly environment: SandboxEnvironment

  /**
   * Create a host execution environment.
   *
   * @param options - Optional working directory used for relative paths and commands.
   */
  constructor(options: { cwd?: string } = {}) {
    super()
    this.cwd = resolve(options.cwd ?? process.cwd())
    this.environment = {
      platform: platformName(process.platform),
      cwd: this.cwd,
      shell: process.platform === 'win32' ? 'PowerShell' : 'sh',
      tempDir: tmpdir(),
    }
  }

  private _resolvePath(path: string): string {
    return isAbsolute(path) ? path : join(this.cwd, path)
  }

  private _executionCwd(path: string | undefined): string {
    return path === undefined ? this.cwd : resolve(this.cwd, path)
  }

  async *executeStreaming(
    command: string,
    options?: ExecuteOptions
  ): AsyncGenerator<StreamChunk | ExecutionResult, void, undefined> {
    validateEnvKeys(options?.env ?? {})
    const processOptions = {
      timeout: options?.timeout,
      signal: options?.signal,
      cwd: this._executionCwd(options?.cwd),
      env: options?.env,
    }
    if (process.platform !== 'win32') {
      yield* streamProcess('sh', ['-c', command], processOptions)
      return
    }

    const scriptPath = join(tmpdir(), `strands-shell-${randomUUID()}.ps1`)
    const script = [
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      '$OutputEncoding = [System.Text.UTF8Encoding]::new($false)',
      command,
      '$ok = $?',
      'if (-not $ok) { if ($LASTEXITCODE) { exit $LASTEXITCODE } else { exit 1 } }',
    ].join('\n')
    await writeFile(scriptPath, `\uFEFF${script}`)
    try {
      yield* streamProcess(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        processOptions
      )
    } finally {
      await unlink(scriptPath).catch(() => undefined)
    }
  }

  async *executeCodeStreaming(
    code: string,
    language: string,
    options?: ExecuteOptions
  ): AsyncGenerator<StreamChunk | ExecutionResult, void, undefined> {
    if (!LANGUAGE_PATTERN.test(language)) {
      throw new Error(`language parameter contains invalid characters: ${language}`)
    }
    validateEnvKeys(options?.env ?? {})
    yield* streamProcess(language, [], {
      timeout: options?.timeout,
      signal: options?.signal,
      enoentMessage: `Language interpreter not found: ${language}`,
      cwd: this._executionCwd(options?.cwd),
      env: options?.env,
      input: code,
    })
  }

  async readFile(path: string): Promise<Uint8Array> {
    return readFile(this._resolvePath(path))
  }

  async writeFile(path: string, content: Uint8Array): Promise<void> {
    const fullPath = this._resolvePath(path)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, content)
  }

  async removeFile(path: string): Promise<void> {
    await unlink(this._resolvePath(path))
  }

  async listFiles(path: string): Promise<FileInfo[]> {
    const fullPath = this._resolvePath(path)
    let entries
    try {
      entries = await readdir(fullPath, { withFileTypes: true })
    } catch (err) {
      // A missing path (or a file where a directory was expected) is non-existence;
      // permission and other errors propagate so callers can surface them.
      if (isMissingPathError(err)) {
        throw new SandboxPathNotFoundError(path)
      }
      throw err
    }
    const results: FileInfo[] = []

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      try {
        const entryStat = await stat(join(fullPath, entry.name))
        results.push({ name: entry.name, isDir: entryStat.isDirectory(), size: entryStat.size })
      } catch {
        results.push({ name: entry.name })
      }
    }

    return results
  }
}

function platformName(platform: string): string {
  if (platform === 'win32') return 'Windows'
  if (platform === 'darwin') return 'Darwin'
  if (platform === 'linux') return 'Linux'
  return platform
}
