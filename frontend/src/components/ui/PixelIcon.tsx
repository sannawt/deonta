import { brandIcons } from "../../lib/brandIcons";

type IconName = keyof typeof brandIcons;

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  alt?: string;
  /** White-background PNG on dark buttons — knocks out white via blend */
  onDark?: boolean;
}

export function PixelIcon({ name, size = 40, className = "", alt = "", onDark = false }: Props) {
  return (
    <img
      src={brandIcons[name]}
      alt={alt}
      width={size}
      height={size}
      className={`ct-pixel-icon ${onDark ? "ct-pixel-icon--on-dark" : ""} ${className}`.trim()}
      draggable={false}
      decoding="async"
    />
  );
}
