// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site:
    process.env.SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://arclens.dev"),
  redirects: {
    "/docs": "/docs/introduction/",
    "/docs/": "/docs/introduction/",
  },
  integrations: [
    react(),
    starlight({
      title: "Arclens",
      description: "Interactive architecture explorer for React/TypeScript",
      logo: {
        src: "./src/assets/arclens-logo.svg",
        alt: "Arclens",
        replacesTitle: true,
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/josh-osagie/arclens",
        },
      ],
      editLink: {
        baseUrl:
          "https://github.com/josh-osagie/arclens/edit/main/www/src/content/docs/",
      },
      head: [
        {
          tag: "link",
          attrs: {
            rel: "preconnect",
            href: "https://fonts.googleapis.com",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "preconnect",
            href: "https://fonts.gstatic.com",
            crossorigin: true,
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
          },
        },
        {
          tag: "script",
          attrs: { is: "inline" },
          content: `if(!localStorage.getItem('starlight-theme')){localStorage.setItem('starlight-theme','dark');}`,
        },
      ],
      customCss: ["./src/styles/starlight.css"],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", slug: "docs/introduction" },
            { label: "Getting started", slug: "docs/getting-started" },
          ],
        },
        {
          label: "Using Arclens",
          items: [
            { label: "CLI reference", slug: "docs/cli-reference" },
            { label: "Viewer guide", slug: "docs/viewer-guide" },
            { label: "Large project walkthrough", slug: "docs/walkthrough" },
            { label: "Concepts", slug: "docs/concepts" },
          ],
        },
        {
          label: "Project",
          items: [{ label: "Roadmap", slug: "docs/roadmap" }],
        },
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
