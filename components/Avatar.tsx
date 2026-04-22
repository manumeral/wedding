import Image from 'next/image'

interface AvatarProps {
  name?: string | null
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  ring?: boolean
  className?: string
}

const dimensionMap: Record<NonNullable<AvatarProps['size']>, { px: number; text: string; w: string }> = {
  xs: { px: 28, text: 'text-xs', w: 'w-7 h-7' },
  sm: { px: 36, text: 'text-sm', w: 'w-9 h-9' },
  md: { px: 48, text: 'text-base', w: 'w-12 h-12' },
  lg: { px: 72, text: 'text-xl', w: 'w-[72px] h-[72px]' },
  xl: { px: 112, text: 'text-3xl', w: 'w-28 h-28' },
  '2xl': { px: 160, text: 'text-4xl', w: 'w-40 h-40' },
}

function initialsOf(name?: string | null) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Stable gradient from name so each guest gets their own consistent color.
const gradients = [
  'from-blush-200 to-wine-600',
  'from-gold-200 to-wine-700',
  'from-blush-300 to-gold-400',
  'from-wine-500 to-wine-800',
  'from-gold-300 to-blush-400',
  'from-blush-100 to-gold-500',
]
function gradientFor(name?: string | null) {
  if (!name) return gradients[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return gradients[Math.abs(hash) % gradients.length]
}

export function Avatar({ name, src, size = 'md', ring = false, className = '' }: AvatarProps) {
  const d = dimensionMap[size]
  const ringClass = ring ? 'ring-4 ring-ivory shadow-soft' : ''

  if (src) {
    return (
      <div className={`relative ${d.w} rounded-full overflow-hidden ${ringClass} ${className}`}>
        <Image
          src={src}
          alt={name ?? 'Avatar'}
          fill
          sizes={`${d.px}px`}
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={`${d.w} rounded-full bg-gradient-to-br ${gradientFor(name)} flex items-center justify-center text-white font-semibold font-serif ${d.text} ${ringClass} ${className}`}
      aria-label={name ?? 'Avatar'}
    >
      {initialsOf(name)}
    </div>
  )
}
