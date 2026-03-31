"use client";

import { ComponentPropsWithRef, forwardRef } from "react";
import { Slot } from "radix-ui";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TooltipIconButtonProps = ComponentPropsWithRef<typeof Button> & {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
};

/**
 * Standard icon-only button with a tooltip and accessible fallback label.
 * This keeps the assistant UI's small action buttons visually consistent while
 * still exposing a readable name to assistive technology.
 */
export const TooltipIconButton = forwardRef<
  HTMLButtonElement,
  TooltipIconButtonProps
>(({ children, tooltip, side = "bottom", className, ...rest }, ref) => {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            {...rest}
            className={cn("aui-button-icon size-6 p-1", className)}
            ref={ref}
          />
        }
      >
        <Slot.Slottable>{children}</Slot.Slottable>
        <span className="aui-sr-only sr-only">{tooltip}</span>
      </TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  );
});

TooltipIconButton.displayName = "TooltipIconButton";
