import type { SVGProps } from 'react'

/**
 * One icon family: 16×16 grid, 1.5px stroke, `currentColor`. Render at 16px in
 * toolbars and rows, 14px inline.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base(size: number | undefined, props: IconProps) {
  const { size: _s, ...rest } = props
  return {
    width: size ?? 16,
    height: size ?? 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  }
}

/** Monochrome brand glyph: a lens over code. */
export function LensLogo({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="7" cy="7" r="4.75" />
      <path d="M10.5 10.5L14 14" />
      <path d="M5.5 7h3M7 5.5v3" opacity=".7" />
    </svg>
  )
}

export function SparkleIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M8 2.5l1.2 3.3 3.3 1.2-3.3 1.2L8 11.5 6.8 8.2 3.5 7l3.3-1.2L8 2.5z" />
      <path d="M12.5 11v3M11 12.5h3" />
    </svg>
  )
}

export function PlusIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}

export function ChevronDownIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4.5 6.5L8 10l3.5-3.5" />
    </svg>
  )
}

export function ChevronRightIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M6.5 4.5L10 8l-3.5 3.5" />
    </svg>
  )
}

export function ArrowRightIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

export function ArrowUpIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M8 13V3M4 7l4-4 4 4" />
    </svg>
  )
}

export function RetryIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M13 8a5 5 0 1 1-1.5-3.6" />
      <path d="M13 2.75v3h-3" />
    </svg>
  )
}

export function PanelLeftIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M6 3v10" />
    </svg>
  )
}

export function CursorTextIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M5 2.5h1.5A1.5 1.5 0 0 1 8 4v8a1.5 1.5 0 0 1-1.5 1.5H5M11 2.5H9.5A1.5 1.5 0 0 0 8 4v8a1.5 1.5 0 0 0 1.5 1.5H11" />
    </svg>
  )
}

export function AlertIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 5v3.5M8 11v.01" />
    </svg>
  )
}

export function FileIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 2h5l3.5 3.5V14H4V2z" />
      <path d="M9 2v3.5h3.5" />
    </svg>
  )
}

export function FolderIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M2 4.25C2 3.56 2.56 3 3.25 3H6l1.5 1.75h5.25c.69 0 1.25.56 1.25 1.25v5.75c0 .69-.56 1.25-1.25 1.25h-9.5C2.56 13 2 12.44 2 11.75v-7.5z" />
    </svg>
  )
}

export function FolderOpenIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M2 12V4.25C2 3.56 2.56 3 3.25 3H6l1.5 1.75h4.25c.69 0 1.25.56 1.25 1.25V7" />
      <path d="M2 12l1.8-4.25c.2-.45.63-.75 1.12-.75H14l-1.75 4.75c-.18.48-.64.8-1.15.8H2.6" />
    </svg>
  )
}

export function CloseIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </svg>
  )
}
