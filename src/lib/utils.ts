import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import {Instance, PdfBox} from "@/lib/definitions.ts";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function createNewClass(className: string, description: string, instances: Instance[]) {
  return {
    id: generateId(),
    name: className,
    description: description,
    color: generateRandomRgbColor(),
    instances: instances
  }
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

export function mergePdfBoxes(boxes: PdfBox[]): PdfBox {
  let minLeft: number | null, minTop: number | null, maxRight: number | null, maxBottom: number | null;
  boxes.forEach((box) => {
    const boxRight = box.left + box.width;
    const boxBottom = box.top + box.height;
    minLeft = !minLeft || box.left < minLeft ? box.left : minLeft;
    minTop = !minTop || box.top < minTop ? box.top : minTop;
    maxRight = !maxRight || boxRight > maxRight ? boxRight : maxRight;
    maxBottom = !maxBottom || boxBottom > maxBottom ? boxBottom : maxBottom;
  });

  return {
    pageNumber: boxes[0].pageNumber,
    left: minLeft!,
    top: minTop!,
    width: maxRight! - minLeft!,
    height: maxBottom! - minTop!
  }
}