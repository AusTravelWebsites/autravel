'use client'

import { forwardRef, ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ─── Button ─────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'sunset'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?:    ButtonSize
  loading?: boolean
  icon?:    ReactNode
  iconRight?: ReactNode
}

const buttonBase = [
  'inline-flex items-center justify-center gap-2 font-body font-medium',
  'transition-all duration-fast ease-out',
  'active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-earth-500 focus-visible:ring-offset-2',
  'select-none cursor-pointer',
].join(' ')

const buttonVariants: Record<ButtonVariant, string> = {
  primary:   'bg-earth text-white hover:bg-earth-700 rounded-md border border-transparent shadow-sm',
  secondary: 'bg-transparent text-earth border border-earth rounded-md hover:bg-earth-50',
  ghost:     'bg-transparent text-slate border border-fog rounded-md hover:bg-haze hover:text-ink',
  danger:    'bg-danger text-white hover:bg-red-700 rounded-md border border-transparent shadow-sm',
  sunset:    'bg-sunset text-white hover:bg-sunset-700 rounded-md border border-transparent shadow-sm',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-7 py-3.5 text-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, iconRight, children, className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : icon}
      {children}
      {!loading && iconRight}
    </button>
  )
)
Button.displayName = 'Button'

// ─── Badge ──────────────────────────────────────────────────────────────────

type BadgeVariant = 'travel' | 'planning' | 'home' | 'tier1' | 'tier2' | 'tier3' | 'gps' | 'default'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
  dot?: boolean
}

const badgeVariants: Record<BadgeVariant, string> = {
  travel:   'bg-emerald-50 text-emerald-800 border border-emerald-200',
  planning: 'bg-sand-100 text-amber-800 border border-sand-500/30',
  home:     'bg-fog text-slate border border-fog',
  tier1:    'bg-sky-100 text-sky-800 border border-sky-500/30',
  tier2:    'bg-violet-50 text-violet-800 border border-violet-200',
  tier3:    'bg-earth-50 text-earth-800 border border-earth-300',
  gps:      'bg-emerald-50 text-emerald-800 border border-emerald-200',
  default:  'bg-haze text-slate border border-fog',
}

const dotColors: Record<BadgeVariant, string> = {
  travel:   'bg-emerald-500',
  planning: 'bg-amber-500',
  home:     'bg-mist',
  tier1:    'bg-sky-500',
  tier2:    'bg-violet-500',
  tier3:    'bg-earth-500',
  gps:      'bg-emerald-500 animate-pulse-gps',
  default:  'bg-mist',
}

export function Badge({ variant = 'default', children, className, dot }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
      badgeVariants[variant],
      className
    )}>
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColors[variant])} />
      )}
      {children}
    </span>
  )
}

// ─── Avatar ─────────────────────────────────────────────────────────────────

interface AvatarProps {
  src?:      string
  name?:     string
  size?:     'xs' | 'sm' | 'md' | 'lg' | 'xl'
  ring?:     boolean
  className?: string
  online?:   boolean
}

const avatarSizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
}

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export function Avatar({ src, name, size = 'md', ring, className, online }: AvatarProps) {
  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <div className={cn(
        'rounded-full flex items-center justify-center font-display font-semibold',
        'bg-earth-100 text-earth-800',
        ring && 'ring-2 ring-earth-700 ring-offset-1',
        avatarSizes[size],
      )}>
        {src ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span>{initials(name)}</span>
        )}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
      )}
    </div>
  )
}

// ─── Input ──────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:   string
  error?:   string
  hint?:    string
  icon?:    ReactNode
  iconRight?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, iconRight, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-slate uppercase tracking-wide mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-mist">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-white border border-fog rounded-md px-3 py-2.5 text-base text-ink',
              'placeholder:text-mist',
              'transition-all duration-fast ease-out',
              'focus:outline-none focus:border-earth-700 focus:ring-3 focus:ring-earth-50',
              error && 'border-danger focus:border-danger focus:ring-danger/10',
              icon && 'pl-10',
              iconRight && 'pr-10',
              className
            )}
            {...props}
          />
          {iconRight && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-mist">
              {iconRight}
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-xs text-mist">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

// ─── Card ───────────────────────────────────────────────────────────────────

interface CardProps {
  children:  ReactNode
  className?: string
  hover?:    boolean
  onClick?:  () => void
  padding?:  'none' | 'sm' | 'md' | 'lg'
}

const cardPadding = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-6',
}

export function Card({ children, className, hover, onClick, padding = 'md' }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border border-fog rounded-lg',
        'transition-all duration-base ease-out',
        hover && 'hover:border-mist hover:shadow-md cursor-pointer',
        cardPadding[padding],
        className
      )}
    >
      {children}
    </div>
  )
}

// ─── Divider ────────────────────────────────────────────────────────────────

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-t border-fog', className)} />
}

// ─── LocationPill ───────────────────────────────────────────────────────────

interface LocationPillProps {
  location: string
  className?: string
  size?: 'sm' | 'md'
}

export function LocationPill({ location, className, size = 'md' }: LocationPillProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 bg-earth-50 text-earth-800 rounded-full font-medium',
      size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      className
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-earth-500 flex-shrink-0" />
      {location}
    </span>
  )
}

// ─── StarRating ─────────────────────────────────────────────────────────────

interface StarRatingProps {
  rating:   number
  max?:     number
  size?:    'sm' | 'md' | 'lg'
  showNum?: boolean
  count?:   number
}

export function StarRating({ rating, max = 5, size = 'md', showNum, count }: StarRatingProps) {
  const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' }

  return (
    <div className="inline-flex items-center gap-1.5">
      <div className={cn('flex', sizes[size])}>
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={i < Math.round(rating) ? 'text-sand-700' : 'text-fog'}
          >
            ★
          </span>
        ))}
      </div>
      {showNum && (
        <span className="text-sm font-semibold text-earth-800">{rating.toFixed(1)}</span>
      )}
      {count !== undefined && (
        <span className="text-xs text-mist">{count.toLocaleString()} reviews</span>
      )}
    </div>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      'bg-fog animate-pulse rounded',
      className
    )} />
  )
}

// ─── GpsBadge ───────────────────────────────────────────────────────────────

interface GpsBadgeProps {
  verified?: boolean
  distance?: string
  className?: string
}

export function GpsBadge({ verified, distance, className }: GpsBadgeProps) {
  if (verified) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800',
        'border border-emerald-200 rounded-full px-2.5 py-0.5 text-xs font-medium',
        className
      )}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-gps flex-shrink-0" />
        GPS verified
      </span>
    )
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 bg-earth-50 text-earth-800',
      'border border-earth-100 rounded-full px-2.5 py-0.5 text-xs font-medium',
      className
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-earth-500 animate-pulse-gps flex-shrink-0" />
      {distance ? `${distance} away` : 'GPS active'}
    </span>
  )
}

// ─── CountryStat ────────────────────────────────────────────────────────────

interface CountryPillProps {
  country: string
  type:    'visited' | 'wishlist'
}

export function CountryPill({ country, type }: CountryPillProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-1 rounded text-xs font-medium',
      type === 'visited'
        ? 'bg-earth text-white'
        : 'bg-sand-100 text-amber-800 border border-sand-500/40'
    )}>
      {country}
    </span>
  )
}
