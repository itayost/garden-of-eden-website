import { BRAND, SITE_URL, type BranchSeo } from "../../../content/seo";

interface Offer {
  name: string;
  price: number;
  description?: string | null;
}

/**
 * schema.org SportsActivityLocation for one branch, so search results show
 * the right address, phone, and prices per city. Rendered as a JSON script:
 * browsers never execute it, so CSP script rules do not apply.
 */
export function LocalBusinessJsonLd({ seo, offers = [] }: { seo: BranchSeo; offers?: Offer[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": ["SportsActivityLocation", "LocalBusiness"],
    "@id": `${SITE_URL}${seo.path}#business`,
    name: `${BRAND} ${seo.cityHe}`,
    alternateName: "גארדן אוף עדן",
    url: `${SITE_URL}${seo.path}`,
    image: `${SITE_URL}/og-image.png`,
    logo: `${SITE_URL}/logo-transparent.png`,
    telephone: seo.phone,
    email: seo.email,
    priceRange: "₪₪",
    address: {
      "@type": "PostalAddress",
      streetAddress: seo.address.street,
      addressLocality: seo.address.city,
      addressCountry: "IL",
    },
    ...(seo.geo
      ? { geo: { "@type": "GeoCoordinates", latitude: seo.geo.lat, longitude: seo.geo.lng } }
      : {}),
    ...(seo.openingHours ? { openingHours: [...seo.openingHours] } : {}),
    sameAs: [
      "https://www.instagram.com/garden_of_eden_soccer_academy/",
      "https://www.tiktok.com/@edenbenhemo1",
    ],
    ...(offers.length > 0
      ? {
          makesOffer: offers.map((offer) => ({
            "@type": "Offer",
            name: offer.name,
            ...(offer.description ? { description: offer.description } : {}),
            price: offer.price,
            priceCurrency: "ILS",
            url: seo.joinUrl,
            availability: "https://schema.org/InStock",
          })),
        }
      : {}),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
