/* ------------------------------------------------------------------
   Experiments registry.
   One primitive: a subdomain of binary1702.com. Everything the page
   renders derives from the slug, so adding an experiment is one line.
   ------------------------------------------------------------------ */
export type Experiment = {
  slug: string;
  label: string;
};

export const ROOT_DOMAIN = "binary1702.com";

export const experiments: Experiment[] = [
  { slug: "skeletor", label: "Skeletor" },
  { slug: "bible-study", label: "Bible Study" },
  { slug: "dogs", label: "Dogs" },
  { slug: "financials", label: "Financials" },
  { slug: "invoice", label: "Invoice" },
  { slug: "library", label: "Library" },
  { slug: "norwood", label: "Norwood" },
  { slug: "sports", label: "Sports" },
  { slug: "worlds", label: "Worlds" },
];

export const experimentHost = (e: Experiment) => `${e.slug}.${ROOT_DOMAIN}`;
export const experimentUrl = (e: Experiment) => `https://${experimentHost(e)}`;
