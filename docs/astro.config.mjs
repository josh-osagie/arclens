// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site:
		process.env.SITE_URL ??
		(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://arclens.vercel.app'),
	integrations: [
		starlight({
			title: 'Arclens',
			description: 'Interactive architecture explorer for React/TypeScript',
			logo: {
				src: './src/assets/arclens-logo.svg',
				alt: 'Arclens',
				replacesTitle: true,
			},
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/JCalmCrasher/arclens',
				},
			],
			editLink: {
				baseUrl: 'https://github.com/JCalmCrasher/arclens/edit/main/docs/',
			},
			head: [
				{
					tag: 'link',
					attrs: {
						rel: 'preconnect',
						href: 'https://fonts.googleapis.com',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'preconnect',
						href: 'https://fonts.gstatic.com',
						crossorigin: true,
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'stylesheet',
						href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
					},
				},
				{
					tag: 'script',
					attrs: { is: 'inline' },
					content: `if(!localStorage.getItem('starlight-theme')){localStorage.setItem('starlight-theme','dark');}`,
				},
			],
			customCss: ['./src/styles/custom.css'],
			sidebar: [
				{
					label: 'Start here',
					items: [
						{ label: 'Home', link: '/' },
						{ label: 'Introduction', slug: 'introduction' },
						{ label: 'Getting started', slug: 'getting-started' },
					],
				},
				{
					label: 'Using Arclens',
					items: [
						{ label: 'CLI reference', slug: 'cli-reference' },
						{ label: 'Viewer guide', slug: 'viewer-guide' },
						{ label: 'Large project walkthrough', slug: 'walkthrough' },
						{ label: 'Concepts', slug: 'concepts' },
					],
				},
				{
					label: 'Project',
					items: [{ label: 'Roadmap', slug: 'roadmap' }],
				},
			],
		}),
	],
});
