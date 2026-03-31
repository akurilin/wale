import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines conditional class names and resolves Tailwind conflicts in one place.
 * This keeps component code readable and avoids repeating the `clsx` + `twMerge`
 * pairing throughout the app.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
