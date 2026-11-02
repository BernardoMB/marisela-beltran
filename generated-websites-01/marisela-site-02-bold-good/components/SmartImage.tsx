import Image from "next/image";
import type { ImageAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface SmartImageProps {
  image: ImageAsset;
  className?: string;
  /** Fill the (relatively positioned, sized) parent instead of using intrinsic width/height. */
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  /** Override alt text (e.g. "" for purely decorative usage next to a visible caption). */
  alt?: string;
}

/**
 * next/image wrapper. Local raster images are optimized; SVG placeholders and remote URLs
 * (YouTube thumbnails, album art CDNs) are rendered unoptimized so no remotePatterns config is needed.
 */
export function SmartImage({ image, className, fill, sizes, priority, alt }: SmartImageProps) {
  const unoptimized = image.src.endsWith(".svg") || /^https?:\/\//i.test(image.src);
  const altText = alt ?? image.alt;
  if (fill) {
    return (
      <Image
        src={image.src}
        alt={altText}
        fill
        sizes={sizes ?? "100vw"}
        priority={priority}
        unoptimized={unoptimized}
        className={cn("object-cover", className)}
      />
    );
  }
  return (
    <Image
      src={image.src}
      alt={altText}
      width={image.width}
      height={image.height}
      sizes={sizes}
      priority={priority}
      unoptimized={unoptimized}
      className={className}
    />
  );
}
