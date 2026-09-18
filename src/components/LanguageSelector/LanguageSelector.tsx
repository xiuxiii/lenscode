import { LANGUAGES } from '../../data/languages'
import type { LanguageId } from '../../types/workspace'
import { ChevronDownIcon } from '../icons'
import './LanguageSelector.css'

interface LanguageSelectorProps {
  value: LanguageId
  onChange: (language: LanguageId) => void
}

export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  return (
    <label className="language-selector" title="Editor language">
      <span className="language-selector__label">Language</span>
      <span className="language-selector__control">
        <select
          className="language-selector__select"
          value={value}
          onChange={(e) => onChange(e.target.value as LanguageId)}
          aria-label="Programming language"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon size={12} className="language-selector__chevron" />
      </span>
    </label>
  )
}
