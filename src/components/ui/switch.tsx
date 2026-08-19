"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
        // The thumb sits at the track's inline start when off and travels to the
        // inline end when on. `translate-x` is physical -- it always moves right
        // -- so under dir="rtl" the on state pushed the thumb off the right edge
        // of the track instead of across it.
        //
        // Keyed off an explicit [dir="rtl"] ancestor rather than Tailwind's rtl:
        // variant: in Tailwind 4 that variant compiles to a :lang() list, so it
        // tracks the document *language* rather than its direction. They happen
        // to agree here (lang="he" dir="rtl"), but direction is the thing that
        // actually decides which way the thumb should travel.
        //
        // Travel is 20px: a w-11 (44px) track less two 2px borders is 40px of
        // inner width, minus the w-5 (20px) thumb.
        "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-5",
        "[[dir=rtl]_&]:data-[state=checked]:-translate-x-5"
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
