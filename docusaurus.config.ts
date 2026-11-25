import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'NestJS con ripopola',
  tagline: 'Curso de NestJS y backend full stack construyendo un proyecto real',
  favicon: 'img/favicon.svg',

  // Cambiar cuando se publique (por ejemplo en GitHub Pages)
  url: 'https://example.com',
  baseUrl: '/',

  onBrokenLinks: 'throw',
  markdown: {
    mermaid: true,
    hooks: { onBrokenMarkdownLinks: 'warn' },
  },

  i18n: {
    defaultLocale: 'es',
    locales: ['es'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/curso',
          sidebarPath: './sidebars.ts',
          showLastUpdateTime: false,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['es'],
        docsRouteBasePath: '/curso',
        indexBlog: false,
      },
    ],
  ],

  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    mermaid: { theme: { light: 'neutral', dark: 'dark' } },
    navbar: {
      title: 'NestJS con ripopola',
      logo: { alt: 'NestJS con ripopola', src: 'img/favicon.svg' },
      items: [
        { type: 'docSidebar', sidebarId: 'curso', position: 'left', label: 'Curso' },
        { to: '/curso/entrevistas', label: 'Repaso para entrevistas', position: 'left' },
        { href: 'https://docs.nestjs.com', label: 'Docs de NestJS', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `Curso propio de Fabrizio Urbisaglia · ${new Date().getFullYear()}`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'docker', 'yaml', 'sql'],
    },
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
  } satisfies Preset.ThemeConfig,
};

export default config;
