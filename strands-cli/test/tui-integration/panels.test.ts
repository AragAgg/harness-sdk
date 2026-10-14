import { describe, expect, it } from 'vitest'

import { sanitizeTerminalText } from '../../src/tui/terminal/sanitize.js'
import { TUI_CASE } from './catalog.js'
import { expectRestoredTerminal, runTuiScenario } from './harness.js'

describe('TUI panel integration', () => {
  it(TUI_CASE.panels.testName, async () => {
    const result = await runTuiScenario(TUI_CASE.panels.scenario)
    const clean = sanitizeTerminalText(result.output)

    expect(result.returnCode).toBe(0)
    expect(clean).toContain('Send a message')
    expect(clean).toContain('Search help')
    expect(clean).toContain('Send your message')
    expect(clean).not.toContain('Viewing Help')
    expect(clean).not.toContain('Viewing Send a message')
    expect(clean).toContain('Current')
    expect(clean).toContain('Enter switch')
    expect(clean).toContain('Arrows · Enter')
    expect(clean).not.toContain('Viewing Agents')
    expect(clean).toContain('Fixture Model Alpha')
    expect(clean).toContain('Reasoning effort')
    expect(clean).not.toContain('Viewing Tasks')
    expect(clean).toContain('Auto-Discovery')
    expect(clean).not.toContain('Viewing Voice')
    expectRestoredTerminal(result)
  })
})
