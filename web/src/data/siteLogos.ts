// Map of site IDs to logo filenames located under /assets/bettingsites in production build
export const LOGOS: Record<string, string> = {
  '1win': '1win.jpg',
  'sports-aviator': 'sportsaviator.jpg',
  '1xbet': '1xbet.png',
  '22bet': '22bet.jpg',
  '4rabet': '4rbet.png',
  '888starz': '888starz.png',
  'bangbet': 'bangbet.png',
  'bantubet': 'bantubet.png',
  'bolabet': 'bolabet.webp',
  'bet365': 'Bet365.png',
  'betfalme': 'betfalme.avif',
  'betgr8': 'betgr8.png',
  'betika': 'betika.webp',
  'sportpesa': 'sportpesa.jpeg',
  'sportybet': 'sportybet.png',
  'betlion': 'betlion.jpeg',
  'betpawa': 'betpawa.webp',
  'betway': 'Betway.jpg',
  'bluechip': 'bluechip.webp',
  'casinodays': 'casinodays.png',
  'chezacash': 'chezacash.png',
  'fortebet': 'fortebet.png',
  'hakibets': 'hakibets.svg',
  'hollywoodbets': 'hollywoodbet.jpg',
  'ilotbet': 'ilotbet.jpeg',
  'kwikbet': 'kwikbet.jpg',
  'melbet': 'melbet.png',
  'mostbet': 'Mostbet.jpg',
  'odibets': 'odibets.jpeg',
  'parimatch': 'parimatch.png',
  'wezabet': 'wezabet.png',
  'winwin': 'winwin.png',
  'betwinner': 'betwinner.jpg',
  'betafriq': 'betafriq.avif',
  'betting-co-zw': '1000229820.jpg',
  // Newly added sites
  'bet9ja': 'Bet9ja.png',
  'betnaija': 'Bet9ja.png',
  'mozzartbet': 'Mozzart.png',
  'premierbet': 'premierbet.png',
  'supabets': 'supabets.jpg',
  '10bet': '10bet.svg',
  'betsson': 'betsson.jpeg',
  'betclic': 'Betclic.png',
  'stake': 'Stake.svg',
  'stake-white': 'Stake.svg',
  'bc-game': 'bcgame.jpeg',
  'roobet': 'roobet.svg',
  '1xbit': '1xbit.webp'
}

// Build the absolute URL used by the app.
// Both dev and prod: serve from /bettingsites/
// Dev files: web/public/bettingsites
// Prod files: web/dist/bettingsites
export function logoUrlFor(id: string): string | undefined {
  const file = LOGOS[id]
  if (!file) return undefined
  const base = '/bettingsites'
  return `${base}/${file}`
}