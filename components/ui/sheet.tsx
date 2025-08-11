import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/50', className)}
    {...props}
  />
))
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: 'left'|'right'|'top'|'bottom' }
>(({ className, side = 'right', ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 gap-4 bg-white p-6 shadow-lg transition ease-in-out',
        side === 'right' && 'inset-y-0 right-0 h-full w-3/4 sm:w-96 border-l',
        side === 'left' && 'inset-y-0 left-0 h-full w-3/4 sm:w-96 border-r',
        side === 'top' && 'inset-x-0 top-0 w-full border-b',
        side === 'bottom' && 'inset-x-0 bottom-0 w-full border-t',
        className
      )}
      {...props}
    />
  </SheetPortal>
))
SheetContent.displayName = DialogPrimitive.Content.displayName

export { Sheet, SheetTrigger, SheetClose, SheetPortal, SheetOverlay, SheetContent }
