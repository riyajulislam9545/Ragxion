import { useRef } from "react";
import { ImagePlus, LoaderCircle, Replace, UploadCloud } from "lucide-react";
import { useAuth } from "@clerk/react";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { getTournamentImageUrl } from "@/lib/tournament-media";

interface TournamentImageUploadProps {
  value?: string | null;
  onChange: (objectPath: string | null) => void;
  compact?: boolean;
}

export default function TournamentImageUpload({
  value,
  onChange,
  compact = false,
}: TournamentImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { getToken } = useAuth();
  const { uploadFile, isUploading, progress, error } = useUpload({ getAuthToken: getToken });
  const imageUrl = getTournamentImageUrl(value);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) return;
    const result = await uploadFile(file);
    if (result?.objectPath) onChange(result.objectPath);
  };

  return (
    <div className="space-y-2">
      <div
        className={`relative overflow-hidden rounded-xl border border-dashed border-primary/35 bg-primary/[0.04] ${
          compact ? "min-h-24" : "min-h-36"
        }`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Tournament artwork preview"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full min-h-36 flex-col items-center justify-center gap-2 px-4 text-center">
            <ImagePlus className="h-7 w-7 text-primary/80" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">No artwork uploaded</p>
            <p className="text-xs text-muted-foreground">JPG, PNG or WEBP up to 10 MB</p>
          </div>
        )}
        {imageUrl && <div className="absolute inset-0 bg-background/45" />}
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3">
          <span className="rounded-md bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
            {isUploading ? `Uploading ${progress}%` : imageUrl ? "Artwork ready" : "Card artwork"}
          </span>
          <Button
            type="button"
            size="sm"
            variant={imageUrl ? "secondary" : "default"}
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="shadow-lg"
          >
            {isUploading ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : imageUrl ? (
              <Replace className="mr-2 h-4 w-4" aria-hidden="true" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {isUploading ? "Uploading" : imageUrl ? "Replace" : "Upload image"}
          </Button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Upload tournament artwork"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />
      {error && <p className="text-xs text-destructive">{error.message}</p>}
      {value && (
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => onChange(null)}
        >
          Remove uploaded artwork
        </button>
      )}
    </div>
  );
}