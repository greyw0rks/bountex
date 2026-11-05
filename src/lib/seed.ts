import type { Task } from './types';
export const previewWorker = 'preview:worker';
export const previewCreator = 'preview:creator';
const illustrations: [string, string, string, string, number, number, string[]][] = [
  [
    'Design',
    'Design a fresh set of app icons',
    'Give our open-source wallet a little personality. Create 4 clean, consistent icons.',
    'Pixel Collective',
    450,
    45,
    [
      '4 original icons as SVG files',
      'One preview image showing the complete set',
      'A short note on your design choices',
    ],
  ],
  [
    'Development',
    'Test our new Mini App',
    'Take our new Mini App for a spin. Find 3 bugs and help us make it better.',
    'Nimiq Builders',
    300,
    20,
    [
      'Test the mobile experience',
      '3 reproducible bug reports with steps',
      'Screenshots or a screen recording',
    ],
  ],
  [
    'Writing',
    'Make Web3 make sense',
    'Write a friendly, jargon-free introduction to Nimiq for someone new to crypto.',
    'The Daily NIM',
    200,
    30,
    [
      'An original 300–500 word article',
      'Explain payments in plain language',
      'Include links to your sources',
    ],
  ],
  [
    'Research',
    'Help shape a better checkout',
    'Explore a checkout flow and share 5 practical ideas to make it easier to use.',
    'Open Commerce',
    250,
    25,
    [
      'Test the supplied checkout flow',
      '5 specific improvements',
      'Screenshots or an annotated document',
    ],
  ],
  [
    'Community',
    'Translate a little. Connect a lot.',
    'Help our welcome guide reach more people. Translate it into your native language.',
    'Nimiq Community',
    180,
    20,
    [
      'Translate the complete welcome guide',
      'Keep the original formatting',
      'State the language and dialect',
    ],
  ],
  [
    'Design',
    'Give our landing page a glow-up',
    'Create a hero section that makes people stop scrolling. Mobile and desktop, please.',
    'Studio Orbit',
    600,
    60,
    [
      'Desktop and mobile Figma frames',
      'One accessible color palette',
      'Link with view access enabled',
    ],
  ],
  [
    'Development',
    'Review a tiny API',
    'Read a small REST API and suggest improvements to error handling and validation.',
    'Build Together',
    350,
    40,
    [
      'Review the linked repository',
      '3 actionable recommendations',
      'Include file names and examples',
    ],
  ],
  [
    'Community',
    'Create a Nimiq quick-start guide',
    'Show a friend how to get started with Nimiq Pay, then write down what helped.',
    'Nimiq Community',
    220,
    30,
    [
      'A short step-by-step guide',
      'Do not include private wallet information',
      'One original illustration or screenshot',
    ],
  ],
  [
    'Writing',
    'Find the words for our next launch',
    'Write 3 short launch announcements for a community tool. Make every word count.',
    'Studio Orbit',
    150,
    15,
    [
      '3 distinct announcements under 280 characters',
      'A clear call to action in each',
      'Avoid investment or guaranteed return claims',
    ],
  ],
];
export function seedTasks(): Task[] {
  const now = Date.now();
  return illustrations.map(
    ([category, title, description, creatorName, reward, minutes, requirements], i) => ({
      id: `sample-${i + 1}`,
      category: category as Task['category'],
      title,
      description,
      creatorName,
      creator: previewCreator,
      avatar: creatorName
        .split(' ')
        .map((x) => x[0])
        .join('')
        .slice(0, 2),
      rewardLuna: reward * 100_000,
      minutes,
      deadline: new Date(now + ((i % 3) + 3) * 86400_000).toISOString(),
      createdAt: new Date(now - (i + 1) * 3600_000).toISOString(),
      status: 'open',
      worker: null,
      requirements,
      featured: i === 1,
    }),
  );
}
