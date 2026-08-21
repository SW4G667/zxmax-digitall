import React, { forwardRef } from "react";

export type PickerMode = "gallery" | "files" | "any";

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "accept" | "capture"> {
  mode: PickerMode;
}

const ACCEPT: Record<PickerMode, string> = {
  gallery: "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/bmp",
  files: ".pdf,.doc,.docx,.txt,.zip,.rar,.csv,.xls,.xlsx,.json",
  any: "*/*",
};

/**
 * Photo pickers open the device gallery (no capture=camera).
 * File pickers open the document browser.
 */
const GalleryFileInput = forwardRef<HTMLInputElement, Props>(function GalleryFileInput(
  { mode, className, ...rest },
  ref,
) {
  return (
    <input
      {...rest}
      ref={ref}
      type="file"
      accept={ACCEPT[mode]}
      className={className}
    />
  );
});

export default GalleryFileInput;
