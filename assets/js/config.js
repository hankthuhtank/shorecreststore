/* ==========================================================================
   SHORECREST STORE SETTINGS
   Public settings only. Any Printify API token lives on the Worker
   (Shorecrest_Worker/SET_SECRETS.bat), never in this file.
   Save, commit, push to main: changes go live with the site.
   ========================================================================== */
window.SC_CONFIG = {

  /* The catalog Worker (Shorecrest_Worker/DEPLOY.bat). Products, prices and photos load live from here.
     If it's unreachable, the site falls back to the saved snapshot (assets/js/catalog-snapshot.js). */
  apiBase: "https://shorecrest-store-api.safisolutions.workers.dev",

  /* Your Printify Pop-Up Store, where checkout happens. */
  popupUrl: "https://shorecrest.printify.me",

  /* Names for products that are variations of each other, keyed by Printify product ID.
     Each pair is shown as one product with a choice (Logo for apparel and hats, Style for canvas). */
  variationLabels: {
    "6ac25368efdfdd3b9809efe8": "Dark logo",    // Shorecrest Mountain Logo Tee (pine wordmark, lighter shirts)
    "6ac253e45c3583a0380de97f": "Light logo",   // Copy of ... Tee (cloud wordmark, darker shirts)
    "6ac25066a0d73b3a3c0e9c41": "Wordmark",     // Shorecrest Trucker Cap (full logo)
    "6ac2512da2febbc29006b155": "Crest"         // Copy of ... Trucker Cap (mountain-and-waves mark)
  },

  /* Optional: override the Buy link for a product (Printify product ID -> Pop-Up product page). */
  buyLinks: {
  },

  currency: "USD",

  /* Your photography portfolio. */
  studioUrl: "https://shorecrest.studio",

  /* Customer support email shown on Help and in the footer. */
  supportEmail: "",

  /* Newsletter: paste your email platform's form endpoint (Mailchimp, Klaviyo, Kit, Formspree...).
     Leave "" and signups show a friendly "opening soon" note (nothing is stored). */
  newsletter: { action: "", method: "POST", field: "email", extraFields: {} },

  social: { instagram: "", tiktok: "" },

  /* Customer-facing policy text for product pages and Help. Leave "" to use the defaults. */
  policies: {
    shipping: "",
    returns: ""
  }
};
