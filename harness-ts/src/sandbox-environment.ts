import type { Sandbox } from '@strands-agents/sdk'

export interface SandboxEnvironment {
  /** Human-readable platform name such as `Linux`, `Darwin`, or `Windows`. */
  platform: string | undefined
  /** Absolute working directory in the sandbox's path syntax. */
  cwd: string | undefined
  /** Shell used by `execute()`, such as `sh`, `PowerShell`, or `pwsh`. */
  shell: string | undefined
  /** Writable scratch directory in the sandbox's path syntax. */
  tempDir: string | undefined
}

export function isPowerShell(shell: string | undefined): boolean {
  return shell !== undefined && /^(powershell|pwsh)/i.test(shell)
}

export function describedEnvironment(sandbox: Sandbox): SandboxEnvironment | undefined {
  const described = (sandbox as { environment?: unknown }).environment
  if (!described || typeof described !== 'object') {
    return undefined
  }
  const pick = (key: keyof SandboxEnvironment): string | undefined => {
    const value = (described as Record<string, unknown>)[key]
    return typeof value === 'string' && value ? value : undefined
  }
  return {
    platform: pick('platform'),
    cwd: pick('cwd'),
    shell: pick('shell'),
    tempDir: pick('tempDir'),
  }
}
