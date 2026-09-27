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
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label={name}>
      <span
        aria-hidden
        className={`${compact ? "h-7 w-7 text-[12px]" : "h-8 w-8 text-sm"} grid shrink-0 place-items-center rounded-[9px] border border-white/[0.11] bg-white/[0.055] font-black tracking-[-0.08em] text-white`}
      >
        Z
      </span>
      <span className={`${compact ? "text-[15px]" : "text-lg"} max-w-[120px] truncate font-extrabold tracking-[-0.045em] text-white`}>
        {name}
      </span>
    </span>
  );
}
