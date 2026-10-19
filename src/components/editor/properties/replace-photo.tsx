"use client";

import { ImagePlus, Images, RefreshCw, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { loadImage } from "@/lib/engine/images";
import type { ImageElement } from "@/lib/schema";
import { ACCEPTED_IMAGE_TYPES, AssetError, importImage } from "@/lib/storage/assets";
import { editorActions, type PhotoTarget } from "@/lib/store/actions";
import { useEditorUi } from "@/lib/store/ui-store";

/**
 * "Replace" (or "Add photo" for an empty frame): upload a photo from the
 * device, or open the Photos panel, where a click swaps the selected one.
 */
export function ReplacePhotoButton({
  target,
  empty = false,
  disabled,
}: {
  target: PhotoTarget;
  empty?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("editor.photo");
  const te = useTranslations("editor.editors");
  const tu = useTranslations("editor.uploads");
  const setPanel = useEditorUi((s) => s.setPanel);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    try {
      const asset = await importImage(file);
      const src = `asset:${asset.id}`;
      await loadImage(src).catch(() => undefined);
      editorActions.placePhoto({ src, width: asset.width, height: asset.height }, { target });
    } catch (error) {
      const code = error instanceof AssetError ? error.code : "decode";
      toast.error(tu(`errors.${code}`, { name: file.name || tu("defaultName") }));
    }
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        hidden
        data-testid="replace-photo-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={disabled}
            data-testid="replace-photo"
          >
            {empty ? <ImagePlus /> : <RefreshCw />} {empty ? te("addPhoto") : t("replace")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onSelect={() => input.current?.click()}>
            <Upload /> {t("replaceUpload")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPanel("photos")} data-testid="replace-photo-stock">
            <Images /> {t("replaceStock")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

/** "Photo by … on Unsplash", linking to the photographer. */
export function PhotoCredit({ attribution }: { attribution: ImageElement["attribution"] }) {
  const t = useTranslations("editor.photo");
  // Only link to Unsplash itself (designs can be imported from anywhere).
  if (attribution?.provider !== "unsplash" || !attribution.url.startsWith("https://unsplash.com/"))
    return null;
  return (
    <p className="text-[11px] text-muted-foreground" data-testid="photo-credit">
      <a
        href={attribution.url}
        target="_blank"
        rel="noreferrer"
        className="underline-offset-2 hover:text-foreground hover:underline"
      >
        {t("credit", { name: attribution.author })}
      </a>
    </p>
  );
}
