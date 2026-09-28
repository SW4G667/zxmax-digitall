import React from "react";
import { useSiteBranding } from "@/context/SiteBrandingContext";

type Props = {
  compact?: boolean;
  className?: string;
};

export default function BrandMark({ compact = false, className = "" }: Props) {
  const { branding } = useSiteBranding();
  const name = branding.siteName || "ZXMAX";

  if (branding.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={name}
        className={`${compact ? "h-7 max-w-[116px]" : "h-8 max-w-[150px]"} object-contain object-left ${className}`}
      />
    );
  }

  return (
    <span
      className={`${compact ? "text-[15px]" : "text-lg"} inline-flex max-w-[150px] truncate font-extrabold tracking-[-0.045em] text-white ${className}`}
      aria-label={name}
    >
      {name}
    </span>
  );
}
