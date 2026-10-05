/**
 * The child's own WhatsApp, opened to the parent with the request and the
 * link: how a purchase request goes out until Meta approves the template.
 */
export function purchaseRequestShareUrl(parentPhoneE164: string, childName: string, url: string): string {
  const text = `היי, ${childName} ביקש/ה לחדש את המסלול בגן עדן. אפשר לבחור מסלול, לחתום ולשלם כאן: ${url}`;
  return `https://wa.me/${parentPhoneE164.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
}
