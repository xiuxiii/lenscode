import type { Risk } from '../src/lib/riskyCommands.ts'
import type { Explanation } from '../src/types/explanation.ts'

/** Text styles; plain pass-throughs when colour is off. */
export interface Style {
  bold: (text: string) => string
  dim: (text: string) => string
  warn: (text: string) => string
}

const ansi = (open: number, close: number) => (text: string) => `\x1b[${open}m${text}\x1b[${close}m`
const plain = (text: string) => text

export function createStyle(color: boolean): Style {
  if (!color) return { bold: plain, dim: plain, warn: plain }
  const bold = ansi(1, 22)
  const yellow = ansi(33, 39)
  return { bold, dim: ansi(2, 22), warn: (text) => bold(yellow(text)) }
}

/** Colour only for a person at a terminal, and never when NO_COLOR is set (no-color.org). */
export function colorEnabled(isTTY: boolean, env: Record<string, string | undefined>): boolean {
  return isTTY && !env.NO_COLOR
}

/**
 * The app's fixed warnings for risky commands, then a blank line, or '' when
 * there are none.
 */
export function formatRisks(risks: Risk[], style: Style): string {
  if (risks.length === 0) return ''
  const lines = risks.map((risk) => `  • ${style.bold(risk.match)} — ${risk.warning}`)
  return `${style.warn('Careful before you run this')}\n${lines.join('\n')}\n\n`
}

/**
 * The parts of an explanation, in the panel's order: the title, the plain
 * answer, what it does here, why it is here, and what to look up next.
 */
export function formatExplanation(explanation: Explanation, style: Style): string {
  const sections = [
    `${style.bold(explanation.concept)}\n${explanation.simpleExplanation}`,
    `${style.bold('In this code')}\n${explanation.contextualExplanation}`,
    `${style.bold('Why it’s here')}\n${explanation.whyItExists}`,
  ]
  if (explanation.relatedConcepts.length > 0) {
    const related = explanation.relatedConcepts.map(({ label, hint }) =>
      hint ? `  • ${style.bold(label)} ${style.dim(`— ${hint}`)}` : `  • ${style.bold(label)}`,
    )
    sections.push(`${style.bold('Related concepts')}\n${related.join('\n')}`)
  }
  return `${sections.join('\n\n')}\n`
}
