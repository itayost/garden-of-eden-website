/**
 * Pelecard's payment page, embedded. Rendered on the server so the page's
 * HTML source shows the frame and its Pelecard address. The parent types the
 * card inside it; nothing on our page can read it.
 */
export function PelecardFrame({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      title="תשלום מאובטח בפלאקארד"
      className="block min-h-[640px] w-full rounded-xl border-0"
      allow="payment"
    />
  );
}
