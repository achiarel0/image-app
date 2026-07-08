import Link from "next/link";

// Shared chrome for the login/signup pages, matching the Atelier look of
// the main page (black promo bar, tracked-out header, light body).

export const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-900";

export const submitClass =
  "inline-flex items-center justify-center rounded-full bg-black px-8 py-3.5 text-sm font-medium uppercase tracking-[0.2em] text-white transition enabled:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300";

export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-xs uppercase tracking-[0.2em] text-neutral-400"
    >
      {children}
    </label>
  );
}

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-white text-neutral-900">
      <div className="bg-black py-2 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white">
        AI Virtual Try-On · Upload · Generate · Download
      </div>

      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-5xl items-center justify-center px-6 py-6">
          <Link
            href="/"
            className="text-2xl font-semibold uppercase tracking-[0.35em]"
          >
            Atelier
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-14">
        <div className="mb-8">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-neutral-400">
            {eyebrow}
          </p>
          <h2 className="text-3xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-neutral-500">{subtitle}</p>
        </div>
        {children}
      </main>

      <footer className="border-t border-neutral-200 py-6 text-center text-xs uppercase tracking-[0.2em] text-neutral-400">
        AI Virtual Try-On
      </footer>
    </div>
  );
}
