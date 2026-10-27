/* ------------------------------------------------------------------
   Engineering projects — the registry behind Section 03 (Selected
   Work) and the /work pages. One entry per application; each names
   the exhibit that visualises its underlying system.

   Nothing here is invented: `url` is omitted until a production URL
   exists (the exhibit then shows no link), and exhibits use small,
   clearly labelled illustrative data.
   ------------------------------------------------------------------ */

export type Status = "Live" | "In Development" | "Experimental" | "Archived";
export type ExhibitKey = "kuya-kaltas" | "anatomy" | "shavat" | "gaia";

export type Project = {
  id: string;           // "001"
  slug: string;         // /work/<slug>
  title: string;
  category: string;
  description: string;  // one or two short lines
  status: Status;
  url?: string;         // the live application; omit until one exists
  exhibit: ExhibitKey;  // which interactive exhibit renders it
  system: string;       // the kind of system the exhibit examines
  featured: boolean;
  /** WHY → WHAT → HOW, in that order of weight */
  inquiry: string;        // the question that motivated the work
  exploration: string;    // what was built to explore it, one sentence
  instruments: string[];  // the engineering that makes it possible
  technology: string[];   // what it is built with, as installed in the repo
};

export const projects: Project[] = [
  {
    id: "001",
    slug: "gaia",
    title: "Gaia",
    category: "Night Sky",
    description: "The night sky over California, explained.",
    status: "Live",
    url: "https://gaia-astrology.binary1702.com",
    exhibit: "gaia",
    system: "The sky",
    featured: true,
    inquiry: "What are we looking at when we look up?",
    exploration: "The sky over one place at one moment — 793 stars and 88 figures from the Hipparcos catalog, placed in real time.",
    instruments: ["Astronomical Computation", "Hipparcos Catalog", "Sidereal Time", "Observer Geometry", "Constellation Mapping", "Interactive Visualization"],
    technology: ["Next.js 16", "React 19", "TypeScript", "astronomy-engine", "Capacitor (iOS / Android)", "Vitest"],
  },
  {
    id: "002",
    slug: "anatomy",
    title: "Anatomy",
    category: "Interactive Visualization",
    description: "Interactive exploration of the human body.",
    status: "Experimental",
    url: "https://anatomy.binary1702.com",
    exhibit: "anatomy",
    system: "Biological structures",
    featured: true,
    inquiry: "How can we understand the world without first understanding ourselves?",
    exploration: "An interactive model of 582 anatomical structures, visible and navigable.",
    instruments: ["3D Visualization", "Mesh Processing", "Draco Compression", "Hierarchical Data", "Spatial Indexing", "Interactive Systems"],
    technology: ["Next.js 16", "React 19", "TypeScript", "Three.js", "React Three Fiber", "Draco", "Blender pipeline"],
  },
  {
    id: "003",
    slug: "shavat",
    title: "Shavat",
    category: "Digital Knowledge Systems",
    description: "An environment for studying scripture.",
    status: "Live",
    url: "https://shavat.app",
    exhibit: "shavat",
    system: "Knowledge relationships",
    featured: true,
    inquiry: "How do we discover meaning through the relationships between people, places, and scripture?",
    exploration: "1,189 chapters as a city seen from above — every cell a real chapter, lit by the verses it holds.",
    instruments: ["Information Architecture", "Structured Text", "Section Modeling", "Reading Progress", "Bookmarks", "Native iOS Shell"],
    technology: ["Next.js 14", "React 18", "TypeScript", "Tailwind CSS", "Capacitor (iOS)", "Zod", "SQL migrations"],
  },
  {
    id: "004",
    slug: "kuya-kaltas",
    title: "Kuya Kaltas",
    category: "Enterprise Operations",
    description: "A connected business operations system.",
    status: "In Development",
    url: "https://kk.binary1702.com",
    exhibit: "kuya-kaltas",
    system: "Business relationships",
    featured: false, // experimental — off the homepage for now
    inquiry: "How can we bring clarity and order to the complexity of human enterprise?",
    exploration: "A connected business system that makes operations, relationships, and financial activity understandable.",
    instruments: ["Workflow Orchestration", "Data Architecture", "Role-Based Access", "Tax Computation", "PDF Generation", "Business Systems"],
    technology: ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS 4", "Base UI", "pdf-lib", "@binary1702/auth"],
  },
];

export const featuredProjects = () => projects.filter((p) => p.featured);
export const projectBySlug = (slug: string) => projects.find((p) => p.slug === slug);
