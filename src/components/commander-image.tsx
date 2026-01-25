import Image from "next/image";
import { getCardImageUrl } from "@/lib/scryfall";

interface CommanderImageProps {
  commanderName: string;
  className?: string;
  size?: "small" | "medium" | "large";
}

const sizeClasses = {
  small: "w-12 h-16",
  medium: "w-24 h-32",
  large: "w-48 h-64",
};

export async function CommanderImage({
  commanderName,
  className = "",
  size = "medium",
}: CommanderImageProps) {
  const imageUrl = await getCardImageUrl(commanderName);

  if (!imageUrl) {
    return (
      <div
        className={`${sizeClasses[size]} bg-zinc-800 rounded-lg flex items-center justify-center ${className}`}
      >
        <span className="text-zinc-600 text-xs text-center px-1">No image</span>
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} relative ${className}`}>
      <Image
        src={imageUrl}
        alt={commanderName}
        fill
        className="rounded-lg object-cover"
        sizes={size === "large" ? "192px" : size === "medium" ? "96px" : "48px"}
      />
    </div>
  );
}
