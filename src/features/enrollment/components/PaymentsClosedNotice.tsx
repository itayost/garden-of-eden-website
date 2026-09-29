import { MessageCircle } from "lucide-react";

/** Shown instead of the signup form and the card form while online payments are closed. */
export function PaymentsClosedNotice() {
  return (
    <section className="rounded-2xl border bg-white p-6 text-center">
      <h2 className="text-xl font-bold">ההרשמה באתר תיפתח בקרוב</h2>
      <p className="mt-2 text-sm text-black/60 sm:text-base">
        בינתיים נשמח לרשום אתכם בוואטסאפ: בוחרים מסלול, ואנחנו שולחים את ההסכם ואת פרטי התשלום.
      </p>
      <a
        href="https://wa.me/972525779446"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-[#25D366] px-6 font-bold text-ink transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.98]"
      >
        <MessageCircle className="h-5 w-5" />
        להרשמה בוואטסאפ 052-577-9446
      </a>
    </section>
  );
}
