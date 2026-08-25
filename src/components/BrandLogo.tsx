import React from "react";

interface Props {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function BrandLogo({ className = "", markClassName, wordmark = true, size = "md" }: Props) {
  const mark = markClassName || (size === "lg" ? "w-11 h-11" : size === "sm" ? "w-7 h-7" : "w-8 h-8");
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-[22px] sm:text-[24px]";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className={mark} aria-hidden>
        <rect width="32" height="32" rx="9" fill="#2B7FFF" />
        <path
          d="M9 11.2C9 9.4 10.5 8 12.4 8h7.2C21.5 8 23 9.4 23 11.2v1.1h-3.1v-.8c0-.5-.4-.9-.9-.9h-5.8c-.5 0-.9.4-.9.9v9.2c0 .5.4.9.9.9h5.8c.5 0 .9-.4.9-.9v-.8H23v1.1c0 1.8-1.5 3.2-3.4 3.2h-7.2C10.5 24 9 22.6 9 20.8V11.2z"
          fill="#fff"
        />
      </svg>
      {wordmark && (
        <span className={`${text} font-black tracking-tight leading-none text-[#2B7FFF]`}>
          ZXMAX
        </span>
      )}
    </span>
  );
}
