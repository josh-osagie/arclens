// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'React Atlas',
			description: 'Interactive architecture explorer for React/TypeScript',
			head: [
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
						{ label: 'Introduction', slug: 'introduction' },
						{ label: 'Getting started', slug: 'getting-started' },
					],
				},
				{
					label: 'Using React Atlas',
					items: [
						{ label: 'CLI reference', slug: 'cli-reference' },
						{ label: 'Viewer guide', slug: 'viewer-guide' },
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
