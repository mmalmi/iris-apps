import { defineConfig, presetUno, presetIcons } from 'unocss';

export default defineConfig({
  safelist: [
    'i-lucide-house',
    'i-lucide-search',
    'i-lucide-bell',
    'i-lucide-users',
    'i-lucide-plus',
    'i-lucide-arrow-up-right',
    'i-lucide-list',
    'i-lucide-layout-list',
    'i-lucide-monitor-speaker',
    'i-lucide-volume-2',
    'i-lucide-shuffle',
    'i-lucide-download',
    'i-lucide-ellipsis',
    'i-lucide-play',
    'i-lucide-skip-back',
    'i-lucide-skip-forward',
    'i-lucide-repeat-2',
    'i-lucide-bookmark',
    'i-lucide-share-2',
    'i-lucide-chevron-left',
    'i-lucide-chevron-right',
  ],
  presets: [
    presetUno(),
    presetIcons({
      scale: 1.1,
      extraProperties: {
        display: 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
});
