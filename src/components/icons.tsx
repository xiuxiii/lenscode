import type { SVGProps } from 'react'

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

export function LensLogo({ size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      {...props}
    >
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <circle cx="14.5" cy="14.5" r="7.2" stroke="#0b0f1a" strokeWidth="2.3" />
      <path d="M20 20l6 6" stroke="#0b0f1a" strokeWidth="2.7" strokeLinecap="round" />
      <path
        d="M11.6 14.5h5.8M14.5 11.6v5.8"
        stroke="#0b0f1a"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity=".75"
      />
    </svg>
  )
}

export function SparkleIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M8 2.5l1.3 3.4L12.7 7l-3.4 1.3L8 11.7 6.7 8.3 3.3 7l3.4-1.1L8 2.5z" fill="currentColor" stroke="none" />
      <path d="M12.8 10.6l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5.5-1.3z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SettingsIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" />
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
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

export function RetryIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M13 8a5 5 0 1 1-1.5-3.6" />
      <path d="M13 2.8v3h-3" />
    </svg>
  )
}

export function SendIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M2.5 8h10M8.5 3.5L13 8l-4.5 4.5" />
    </svg>
  )
}

export function PanelLeftIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="2" y="3" width="12" height="10" rx="1.6" />
      <path d="M6 3v10" />
    </svg>
  )
}

export function CursorTextIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M5 2.5h1.5A1.5 1.5 0 0 1 8 4v8a1.5 1.5 0 0 1-1.5 1.5H5M11 2.5H9.5A1.5 1.5 0 0 0 8 4v8a1.5 1.5 0 0 0 1.5 1.5H11" />
      <path d="M2.5 6h2v4h-2M13.5 6h-2v4h2" opacity=".55" />
    </svg>
  )
}

export function AlertIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M8 2.2L14 13H2L8 2.2z" />
      <path d="M8 6.5v3M8 11.3v.2" />
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

export function HistoryIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M2.8 8a5.2 5.2 0 1 0 1.6-3.7" />
      <path d="M2.5 2.8v2.6h2.6M8 5.3V8l2 1.3" />
    </svg>
  )
}

export function FolderIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M2 4.2c0-.66.54-1.2 1.2-1.2h3l1.5 1.7h5.1c.66 0 1.2.54 1.2 1.2v6.4c0 .66-.54 1.2-1.2 1.2H3.2c-.66 0-1.2-.54-1.2-1.2V4.2z" />
    </svg>
  )
}

export function FolderOpenIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M2 12V4.2c0-.66.54-1.2 1.2-1.2h3l1.5 1.7h4.4c.66 0 1.2.54 1.2 1.2v1.3" />
      <path d="M2 12l1.8-4.4c.18-.45.62-.75 1.1-.75h9.1L12.3 12.3c-.18.42-.6.7-1.07.7H2" />
    </svg>
  )
}

export function ChevronRightIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M6 4l4 4-4 4" />
    </svg>
  )
}

export function CloseIcon({ size, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}
