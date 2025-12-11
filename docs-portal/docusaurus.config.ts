import { Config } from '@docusaurus/types';
import { themes } from 'prism-react-renderer';

const config: Config = {
  title: '中道商城系统文档',
  tagline: '多层级供应链社交电商平台技术文档',
  url: 'https://docs.zhongdao-mall.com',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',

  organizationName: 'zhongdao',
  projectName: 'zhongdao-mall',

  i18n: {
    defaultLocale: 'zh-CN',
    locales: ['zh-CN'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/zhongdao/zhongdao-mall/tree/main/docs-portal/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],

  plugins: [
    [
      'redocusaurus',
      {
        spec: '../api-docs.json',
        themeId: 'api',
      },
    ],
    [
      '@docusaurus/plugin-ideal-image',
      {
        quality: 70,
        max: 1030,
        min: 640,
        steps: 2,
        disableInDev: false,
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: '中道商城',
      logo: {
        alt: '中道商城Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'doc',
          docId: 'intro',
          position: 'left',
          label: '文档首页',
        },
        {
          to: '/api',
          label: 'API文档',
          position: 'left',
        },
        {
          to: '/architecture',
          label: '架构设计',
          position: 'left',
        },
        {
          to: '/guides',
          label: '开发指南',
          position: 'left',
        },
        {
          to: '/adr',
          label: '架构决策',
          position: 'left',
        },
        {
          href: 'https://github.com/zhongdao/zhongdao-mall',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '文档',
          items: [
            {
              label: '快速开始',
              to: '/docs/intro',
            },
            {
              label: 'API参考',
              to: '/api',
            },
            {
              label: '架构概述',
              to: '/docs/architecture/overview',
            },
          ],
        },
        {
          title: '社区',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/zhongdao/zhongdao-mall',
            },
            {
              label: '问题反馈',
              href: 'https://github.com/zhongdao/zhongdao-mall/issues',
            },
          ],
        },
        {
          title: '更多',
          items: [
            {
              label: '更新日志',
              to: '/blog',
            },
            {
              label: '中道商城',
              href: 'https://www.zhongdao-mall.com',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} 中道商城. Built with Docusaurus.`,
    },
    prism: {
      theme: themes.vsDark,
      darkTheme: themes.vsDark,
      additionalLanguages: ['json', 'bash', 'diff', 'mermaid'],
    },
    mermaid: {
      theme: {
        light: 'default',
        dark: 'dark',
      },
    },
  },
  customFields: {
    apiBaseUrl: 'https://api.zhongdao-mall.com/api/v1',
    githubRepo: 'https://github.com/zhongdao/zhongdao-mall',
    feedbackUrl: 'https://github.com/zhongdao/zhongdao-mall/issues/new?template=documentation-feedback.md',
  },
};

export default config;