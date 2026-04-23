type Label = { id: string; name: string }

const CHIP_PALETTE = [
  'bg-blush-100 text-wine-800 border-blush-200/90',
  'bg-gold-100 text-amber-900 border-gold-200/90',
  'bg-emerald-100 text-emerald-900 border-emerald-200/80',
  'bg-violet-100 text-violet-900 border-violet-200/80',
  'bg-sky-100 text-sky-900 border-sky-200/80',
  'bg-rose-100 text-rose-900 border-rose-200/80',
] as const

function chipClassForId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 997
  return CHIP_PALETTE[Math.abs(h) % CHIP_PALETTE.length]
}

/** Read-only group labels for admin tables (demarcated pill styles). */
export function GuestGroupLabelChips({ groups }: { groups: Label[] }) {
  if (groups.length === 0) {
    return <span className="text-stone-400 text-sm">—</span>
  }

  const sorted = [...groups].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex flex-wrap gap-1.5 max-w-[20rem]">
      {sorted.map((g) => (
        <span
          key={g.id}
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm ${chipClassForId(g.id)}`}
        >
          {g.name}
        </span>
      ))}
    </div>
  )
}
