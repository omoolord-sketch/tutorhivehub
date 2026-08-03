import { ArrowLeft, Home } from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";

export function PublicNotFoundPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl flex-col justify-center">
        <a href="/" aria-label="TutorHiveHub home">
          <BrandLogo />
        </a>
        <section className="mt-10 rounded-lg border border-slate-200 bg-white p-8 shadow-soft">
          <p className="text-sm font-black uppercase text-gold">404</p>
          <h1 className="mt-3 text-4xl font-black text-navy">Page not found</h1>
          <p className="mt-5 max-w-2xl leading-7 text-slate-650">
            The page you are looking for is not available on TutorHiveHub.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-5 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-gold-100 focus:outline-none focus:ring-4 focus:ring-gold/30"
            >
              <Home className="h-5 w-5" aria-hidden="true" />
              Return Home
            </a>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-5 py-3 text-sm font-black text-navy shadow-sm transition hover:border-gold hover:bg-gold-50 focus:outline-none focus:ring-4 focus:ring-gold/20"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              Go Back
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
