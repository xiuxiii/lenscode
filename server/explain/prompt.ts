import { getLanguage } from '../../src/data/languages.ts'
import type {
  ExplanationRequest,
  FollowUpRequest,
  SourceRange,
} from '../../src/types/explanation.ts'

/**
 * Turns an `ExplanationRequest` (or a follow-up question about one) into chat
 * messages. This is the only place the prompts live; the browser never sees
 * them.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Lines of file shown either side of the selection. */
const CONTEXT_RADIUS = 40
/** Hard cap on the surrounding code sent upstream, to bound cost and latency. */
const MAX_CONTEXT_CHARS = 12_000
/** Lines shown from the top of the file when there is no selection range. */
const HEAD_LINES = 120

const SYSTEM_PROMPT = `You are LensCode, a tool that explains one highlighted piece of code to the person reading it. Be accurate, concrete and brief. Write for someone who may know little or nothing about programming.

Respond with a single JSON object and nothing else. Use exactly these keys:

{
  "title": "2–4 word label for what the selection is, e.g. \\"Declaration keyword\\", \\"Method call\\", \\"Template literal\\"",
  "kind": "one of: keyword, identifier, call, expression, statement, literal, operator, declaration, element, property, selector, type",
  "whatIsIt": "1–2 plain-language sentences. No jargon.",
  "technicalDefinition": "One precise sentence, as a language reference would word it.",
  "inThisCode": "2–3 sentences on what the selection does in THIS file, using the real names from the code.",
  "whyItsHere": "1–2 sentences on why the author used it here rather than an alternative.",
  "relatedConcepts": [
    { "name": "1–3 words the reader could explore next", "explanation": "a phrase under 8 words" }
  ]
}

Rules:
- Give 3 to 5 related concepts. Each name must be short enough to look up on its own, e.g. "Promise", "block scope".
- Plain text only: no markdown, no backticks. To mention an identifier or snippet, wrap it in double quotes, e.g. the "response" variable.
- Never invent code that is not in the file. If the selection is a concept name rather than code from the file, explain the concept and connect it to the file only where it genuinely applies.
- The language was detected automatically and can be wrong. If the code is clearly another language, explain it as that language and say which one in "whatIsIt".
- If the selection is a terminal command: say what happens when it is run, what each part and flag means, and whether it changes, deletes or uploads anything. Call out anything destructive or hard to undo (deleting files, force-pushing, sudo, overwriting) plainly in "whatIsIt".
- The reader may be brand new to programming. Prefer everyday words; when a technical term is unavoidable, explain it in the same sentence.
- If the selection is empty, unintelligible or not code, still return the same JSON shape and say so in "whatIsIt".`

const FOLLOW_UP_PROMPT = `You are LensCode, a tool that explains code to the person reading it. They highlighted a piece of code, read your explanation of it, and now have a follow-up question. Answer that question. Be accurate, concrete and brief. Write for someone who may know little or nothing about programming.

Respond with a single JSON object and nothing else:

{ "answer": "your answer" }

Rules:
- Answer the question that was asked, directly, in the first sentence. Usually 2–5 sentences; go longer only if the question really needs it.
- Plain text only: no markdown, no headings, no bullet symbols, no backticks. Separate paragraphs with a blank line. To mention an identifier or snippet, wrap it in double quotes, e.g. the "response" variable.
- Ground the answer in the file shown. Never claim the file contains code it does not. A short illustrative snippet is fine if it helps; keep it to one line, in double quotes, and say it is an example.
- If the earlier explanation was wrong or incomplete, say so plainly and correct it.
- If the question is about a terminal command, say clearly whether running it changes, deletes or uploads anything.
- The reader may be brand new to programming. Prefer everyday words; when a technical term is unavoidable, explain it in the same sentence.
- If the question has nothing to do with the code or programming, say briefly that you can only help with the code, and suggest something they could ask instead.`

function numberLines(lines: string[], firstLine: number, range: SourceRange | null): string {
  const width = String(firstLine + lines.length - 1).length
  return lines
    .map((line, i) => {
      const n = firstLine + i
      const selected = range && n >= range.startLine && n <= range.endLine
      return `${selected ? '>' : ' '} ${String(n).padStart(width)} | ${line}`
    })
    .join('\n')
}

function capChars(text: string): string {
  return text.length > MAX_CONTEXT_CHARS
    ? `${text.slice(0, MAX_CONTEXT_CHARS)}\n… (truncated)`
    : text
}

/** The part of the file worth sending: a window around the selection. */
export function excerptSource(fullSource: string, range: SourceRange | null): string {
  const lines = fullSource.split('\n')
  if (!range) {
    const head = lines.slice(0, HEAD_LINES)
    const more = lines.length > HEAD_LINES ? '\n… (rest of file omitted)' : ''
    return capChars(numberLines(head, 1, null) + more)
  }
  const from = Math.max(1, range.startLine - CONTEXT_RADIUS)
  const to = Math.min(lines.length, range.endLine + CONTEXT_RADIUS)
  return capChars(numberLines(lines.slice(from - 1, to), from, range))
}

/** What was highlighted, in which file and language, and the code around it. */
function describeSelection(request: ExplanationRequest): string[] {
  const { selectedCode, language, fileName, surroundingContext } = request
  const { fullSource, range } = surroundingContext
  const languageLabel = getLanguage(language).label

  const where = range
    ? range.startLine === range.endLine
      ? `line ${range.startLine}`
      : `lines ${range.startLine}–${range.endLine}`
    : null

  const parts = [
    `File: ${fileName ?? '(untitled)'}`,
    language === 'plaintext'
      ? 'Language: not detected — work it out from the code'
      : `Language (auto-detected): ${languageLabel}`,
    '',
    where
      ? `The user highlighted this, on ${where}:`
      : 'The user asked about this (it may be a concept name rather than code from the file):',
    '<<<SELECTION',
    selectedCode.trim(),
    'SELECTION>>>',
  ]

  if (fullSource.trim()) {
    parts.push(
      '',
      where
        ? 'Surrounding code (selected lines are marked with ">"):'
        : 'The file it relates to:',
      '<<<FILE',
      excerptSource(fullSource, range),
      'FILE>>>',
    )
  }

  return parts
}

export function buildMessages(request: ExplanationRequest): ChatMessage[] {
  const parts = [...describeSelection(request), '', 'Explain the selection as JSON.']
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: parts.join('\n') },
  ]
}

/**
 * The selection and its context, the explanation the reader was shown, then
 * the thread so far as alternating turns, ending with the new question.
 */
export function buildFollowUpMessages({
  request,
  explanation,
  previous,
  question,
}: FollowUpRequest): ChatMessage[] {
  const context = [
    ...describeSelection(request),
    '',
    'The explanation they were shown:',
    '<<<EXPLANATION',
    `Title: ${explanation.concept}`,
    `What it is: ${explanation.simpleExplanation}`,
    `Technical definition: ${explanation.definition}`,
    `In this code: ${explanation.contextualExplanation}`,
    `Why it's here: ${explanation.whyItExists}`,
    'EXPLANATION>>>',
  ].join('\n')

  const asked = (q: string) => `Their question: ${q.trim()}\n\nAnswer as JSON.`
  const thread: ChatMessage[] = previous.flatMap((turn, i) => [
    { role: 'user', content: i === 0 ? `${context}\n\n${asked(turn.question)}` : asked(turn.question) },
    { role: 'assistant', content: JSON.stringify({ answer: turn.answer }) },
  ])

  return [
    { role: 'system', content: FOLLOW_UP_PROMPT },
    ...thread,
    {
      role: 'user',
      content: previous.length === 0 ? `${context}\n\n${asked(question)}` : asked(question),
    },
  ]
}
