"use client";

import { useCallback, useRef, useState } from "react";

// Posts to our own server route, which proxies to the n8n webhook. The
// webhook URL is a server-only secret and is never exposed to the browser.
const GENERATE_ENDPOINT = "/api/generate";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const INVALID_TYPE_MESSAGE = "Please upload JPEG, PNG, or WebP only.";
const GENERIC_ERROR = "Failed to generate image. Please try again.";

type Slot = {
  file: File | null;
  preview: string | null;
  warning: string | null;
};

const EMPTY_SLOT: Slot = { file: null, preview: null, warning: null };

export default function Home() {
  const [image1, setImage1] = useState<Slot>(EMPTY_SLOT);
  const [image2, setImage2] = useState<Slot>(EMPTY_SLOT);
  const [isLoading, setIsLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelect = useCallback(
    (slot: Slot, setSlot: (s: Slot) => void, fileList: FileList | null) => {
      const file = fileList?.[0] ?? null;

      // Always release the previous preview URL to avoid leaks.
      if (slot.preview) URL.revokeObjectURL(slot.preview);

      if (!file) {
        setSlot(EMPTY_SLOT);
        return;
      }

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setSlot({ file: null, preview: null, warning: INVALID_TYPE_MESSAGE });
        return;
      }

      setSlot({ file, preview: URL.createObjectURL(file), warning: null });
    },
    [],
  );

  async function generateImage() {
    setIsLoading(true);
    setErrorMessage(null);

    // Release any previous result before generating a new one.
    if (resultImage) {
      URL.revokeObjectURL(resultImage);
      setResultImage(null);
    }

    try {
      const formData = new FormData();
      formData.append("image1", image1.file!);
      formData.append("image2", image2.file!);

      const response = await fetch(GENERATE_ENDPOINT, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`Request failed: ${response.status}`);

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setResultImage(imageUrl);
    } catch {
      setErrorMessage(GENERIC_ERROR);
    } finally {
      setIsLoading(false);
    }
  }

  const canGenerate = Boolean(image1.file && image2.file) && !isLoading;

  return (
    <div className="flex min-h-full flex-col bg-white text-neutral-900">
      {/* Top promo bar */}
      <div className="bg-black py-2 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white">
        AI Virtual Try-On · Upload · Generate · Download
      </div>

      {/* Header */}
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-5xl items-center justify-center px-6 py-6">
          <h1 className="text-2xl font-semibold uppercase tracking-[0.35em]">
            Atelier
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-8">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-neutral-400">
            Image Synthesis
          </p>
          <h2 className="text-3xl font-semibold">Virtual Try-On</h2>
          <p className="mt-2 max-w-xl text-sm text-neutral-500">
            Upload a photo of a person and a garment. We&apos;ll blend them into a
            single generated image.
          </p>
        </div>

        {/* Upload row */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <UploadCard
            index={1}
            label="The Person"
            hint="JPEG, PNG, WebP"
            slot={image1}
            onSelect={(files) => handleSelect(image1, setImage1, files)}
          />
          <UploadCard
            index={2}
            label="The Garment"
            hint="JPEG, PNG, WebP"
            slot={image2}
            onSelect={(files) => handleSelect(image2, setImage2, files)}
          />
        </div>

        {/* CTA */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={generateImage}
            disabled={!canGenerate}
            className="inline-flex min-w-[220px] items-center justify-center gap-3 rounded-full bg-black px-8 py-3.5 text-sm font-medium uppercase tracking-[0.2em] text-white transition enabled:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {isLoading ? (
              <>
                <Spinner />
                Processing...
              </>
            ) : (
              "Generate Image"
            )}
          </button>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
            >
              {errorMessage}
            </p>
          )}
        </div>

        {/* Output */}
        <section className="mt-12">
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-neutral-400">
            Result
          </p>

          <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 p-6">
            {resultImage ? (
              <div className="flex w-full flex-col items-center gap-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resultImage}
                  alt="Generated try-on result"
                  className="max-h-[480px] w-auto rounded-lg border border-neutral-200 bg-white object-contain shadow-sm"
                />
                <a
                  href={resultImage}
                  download="virtual-try-on.png"
                  className="inline-flex items-center justify-center rounded-full border border-black px-6 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-black transition hover:bg-black hover:text-white"
                >
                  Download
                </a>
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center gap-3 text-neutral-400">
                <Spinner dark />
                <span className="text-sm uppercase tracking-[0.2em]">
                  Processing...
                </span>
              </div>
            ) : (
              <p className="text-sm text-neutral-400">
                Your generated image will appear here.
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 py-6 text-center text-xs uppercase tracking-[0.2em] text-neutral-400">
        AI Virtual Try-On
      </footer>
    </div>
  );
}

function UploadCard({
  index,
  label,
  hint,
  slot,
  onSelect,
}: {
  index: number;
  label: string;
  hint: string;
  slot: Slot;
  onSelect: (files: FileList | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-medium">
          <span className="text-neutral-400">0{index}</span> &nbsp;{label}
        </span>
        <span className="text-xs uppercase tracking-[0.15em] text-neutral-400">
          {hint}
        </span>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative flex min-h-[260px] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-white transition hover:border-neutral-900"
      >
        {slot.preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slot.preview}
              alt={`${label} preview`}
              className="h-full max-h-[260px] w-full object-contain p-3"
            />
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-4 py-1 text-[11px] uppercase tracking-[0.15em] text-white opacity-0 transition group-hover:opacity-100">
              Change
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-neutral-400">
            <PlusIcon />
            <span className="text-sm">Click to upload</span>
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => onSelect(e.target.files)}
      />

      {slot.warning && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {slot.warning}
        </p>
      )}
    </div>
  );
}

function Spinner({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${
        dark ? "text-neutral-500" : "text-white"
      }`}
      aria-hidden="true"
    />
  );
}

function PlusIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
