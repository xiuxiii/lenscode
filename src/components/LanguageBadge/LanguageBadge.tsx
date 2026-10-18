import type { CSSProperties } from 'react'
import { getLanguage } from '../../data/languages'
import type { LanguageId } from '../../types/workspace'
import './LanguageBadge.css'

interface LanguageBadgeProps {
  language: LanguageId
}

/**
 * Read-only label for the auto-detected language. There is deliberately no
 * way to change it: the language always follows the code.
 */
export function LanguageBadge({ language }: LanguageBadgeProps) {
  const lang = getLanguage(language)
  const detected = language !== 'plaintext'
  return (
    <span
      className={`language-badge${detected ? '' : ' language-badge--pending'}`}
      style={{ '--lang-color': lang.color } as CSSProperties}
      title={`${lang.description}${detected ? ' (Detected automatically from the code.)' : ''}`}
    >
      <span className="language-badge__dot" aria-hidden="true" />
      <span className="language-badge__label">{lang.label}</span>
      {detected && <span className="language-badge__auto">auto-detected</span>}
    </span>
  )
}

interface LanguageIntroProps {
  language: LanguageId
}

/**
 * The language name plus one plain-English sentence about it, shown at the
 * top of the explanation panel for readers who are new to code.
 */
export function LanguageIntro({ language }: LanguageIntroProps) {
  const lang = getLanguage(language)
  const detected = language !== 'plaintext'
  return (
    <div
      className="language-intro"
      style={{ '--lang-color': lang.color } as CSSProperties}
      aria-label={`Language: ${lang.label}`}
    >
      <div className="language-intro__row">
        <span className="language-badge__dot" aria-hidden="true" />
        <span className="language-intro__name">
          {detected ? `This is ${lang.phrase ?? lang.label}` : 'Language not detected yet'}
        </span>
      </div>
      <p className="language-intro__description">{lang.description}</p>
    </div>
  )
}
