"use client"
import * as React from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import type { EmblaOptionsType } from 'embla-carousel'
import { cn } from '@/lib/utils'

export function Carousel({ className, options, children }: { className?: string; options?: EmblaOptionsType; children: React.ReactNode }) {
  const [emblaRef] = useEmblaCarousel(options)
  return (
    <div className={cn('overflow-hidden', className)} ref={emblaRef}>
      <div className="flex -ml-4">
        {React.Children.map(children, (child, i) => (
          <div className="min-w-0 flex-[0_0_100%] pl-4" key={i}>{child}</div>
        ))}
      </div>
    </div>
  )
}

