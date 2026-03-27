import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function rgbaToHex(rgba: string, overrideAlpha: number | null = null): string {
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]*)\)/.exec(rgba);
  if (!match) throw new Error(`Invalid rgba string: ${rgba}`);

  const [, r, g, b, a] = match
  const toHex = (n: number) => n.toString(16).padStart(2, "0");

  const hex = `#${toHex(+r)}${toHex(+g)}${toHex(+b)}`;
  const alpha = overrideAlpha ? toHex(Math.round(overrideAlpha * 255)) : toHex(Math.round(parseFloat(a) * 255));
  return `${hex}${alpha}`;
}

export function generateRandomRgbColor(){
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgba(${r}, ${g}, ${b}, 0.3)`;
};