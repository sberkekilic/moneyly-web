import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const generateId = (): number => Date.now();

export const isClient = typeof window !== 'undefined';

export const validateDay = (day: number, referenceDate: Date): Date => {
  const lastDay = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    0
  ).getDate();
  const safeDay = Math.min(day, lastDay);
  let date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), safeDay);
  // Skip weekends
  if (date.getDay() === 6) date = new Date(date.getTime() + 2 * 86400000);
  if (date.getDay() === 0) date = new Date(date.getTime() + 86400000);
  return date;
};