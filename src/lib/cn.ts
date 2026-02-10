import { clsx, type ClassValue } from 'clsx';

/**
 * Utility for combining classNames with Tailwind CSS
 * Merges conflicting Tailwind classes intelligently
 */
export function cn(...classes: ClassValue[]): string {
  return clsx(classes);
}
