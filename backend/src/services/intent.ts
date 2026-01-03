// App categories mapping
const appCategories: { [key: string]: string } = {
  // Social Media
  'com.facebook.katana': 'social',
  'com.facebook.orca': 'social',
  'com.instagram.android': 'social',
  'com.twitter.android': 'social',
  'com.whatsapp': 'communication',
  'com.snapchat.android': 'social',
  'com.linkedin.android': 'social',
  'org.telegram.messenger': 'communication',

  // Productivity
  'com.google.android.apps.docs': 'productivity',
  'com.google.android.apps.docs.editors.docs': 'productivity',
  'com.google.android.apps.docs.editors.sheets': 'productivity',
  'com.google.android.apps.docs.editors.slides': 'productivity',
  'com.microsoft.office.word': 'productivity',
  'com.microsoft.office.excel': 'productivity',
  'com.microsoft.office.powerpoint': 'productivity',
  'com.slack': 'productivity',
  'com.asana.app': 'productivity',
  'com.trello': 'productivity',
  'com.notion.id': 'productivity',

  // Development
  'com.termux': 'development',
  'com.aide.ui': 'development',
  'com.github.android': 'development',

  // Entertainment
  'com.netflix.mediaclient': 'entertainment',
  'com.google.android.youtube': 'entertainment',
  'com.amazon.avod.thirdpartyclient': 'entertainment',
  'com.disney.disneyplus': 'entertainment',
  'com.spotify.music': 'entertainment',
  'com.google.android.apps.youtube.music': 'entertainment',

  // Games
  'com.supercell.clashofclans': 'gaming',
  'com.pubg.krmobile': 'gaming',
  'com.tencent.ig': 'gaming',
  'com.kiloo.subwaysurf': 'gaming',
  'com.king.candycrushsaga': 'gaming',

  // Shopping
  'com.amazon.mShop.android.shopping': 'shopping',
  'in.amazon.mShop.android.shopping': 'shopping',
  'com.flipkart.android': 'shopping',
  'com.alibaba.aliexpresshd': 'shopping',
  'com.ebay.mobile': 'shopping',

  // Finance
  'com.google.android.apps.walletnfcrel': 'finance',
  'com.paypal.android.p2pmobile': 'finance',
  'net.one97.paytm': 'finance',
  'com.phonepe.app': 'finance',

  // News & Reading
  'com.google.android.apps.magazines': 'reading',
  'flipboard.app': 'reading',
  'com.amazon.kindle': 'reading',
  'com.medium.reader': 'reading',

  // System / Utilities
  'com.android.settings': 'system',
  'com.google.android.apps.photos': 'utility',
  'com.google.android.gm': 'communication',
  'com.google.android.apps.maps': 'utility',
  'com.android.chrome': 'browsing',
  'org.mozilla.firefox': 'browsing',
  'com.brave.browser': 'browsing',
};

// Intent category mapping
const intentCategories: { [key: string]: string } = {
  'social': 'Communication',
  'communication': 'Communication',
  'productivity': 'Business Operations',
  'development': 'Software Development',
  'entertainment': 'Media Consumption',
  'gaming': 'Media Consumption',
  'shopping': 'Business Operations',
  'finance': 'Business Operations',
  'reading': 'Learning / Research',
  'browsing': 'Learning / Research',
  'system': 'Context Switching',
  'utility': 'Context Switching',
};

export interface IntentResult {
  category: string;
  confidence: number;
  reasoning: string;
  app_type: string;
}

export function inferIntent(
  appPackage: string,
  appLabel: string,
  durationMs: number
): IntentResult | null {
  // Get app category
  let appType = appCategories[appPackage] || 'unknown';

  // Try to infer from app label if not found
  if (appType === 'unknown') {
    const labelLower = appLabel.toLowerCase();
    if (labelLower.includes('chat') || labelLower.includes('message')) {
      appType = 'communication';
    } else if (labelLower.includes('game') || labelLower.includes('play')) {
      appType = 'gaming';
    } else if (labelLower.includes('video') || labelLower.includes('music') || labelLower.includes('player')) {
      appType = 'entertainment';
    } else if (labelLower.includes('browser') || labelLower.includes('chrome') || labelLower.includes('firefox')) {
      appType = 'browsing';
    } else if (labelLower.includes('mail') || labelLower.includes('email')) {
      appType = 'communication';
    } else if (labelLower.includes('note') || labelLower.includes('doc') || labelLower.includes('office')) {
      appType = 'productivity';
    } else if (labelLower.includes('shop') || labelLower.includes('store') || labelLower.includes('cart')) {
      appType = 'shopping';
    } else if (labelLower.includes('bank') || labelLower.includes('pay') || labelLower.includes('money')) {
      appType = 'finance';
    } else if (labelLower.includes('learn') || labelLower.includes('course') || labelLower.includes('study')) {
      appType = 'reading';
    }
  }

  // Get intent category
  const intentCategory = intentCategories[appType] || 'Unknown / Mixed';

  // Calculate confidence based on duration and app type recognition
  let confidence = 0.5;

  // Known app increases confidence
  if (appCategories[appPackage]) {
    confidence += 0.3;
  }

  // Longer duration increases confidence
  if (durationMs > 60000) { // More than 1 minute
    confidence += 0.1;
  }
  if (durationMs > 300000) { // More than 5 minutes
    confidence += 0.1;
  }

  // Cap confidence at 0.95
  confidence = Math.min(confidence, 0.95);

  // Generate reasoning
  let reasoning = `User spent ${Math.round(durationMs / 1000)} seconds on ${appLabel}`;

  if (appType !== 'unknown') {
    reasoning += ` (${appType} app)`;
  }

  if (intentCategory === 'Communication') {
    reasoning += '. Activity suggests communication or social interaction.';
  } else if (intentCategory === 'Business Operations') {
    reasoning += '. Activity suggests work-related or business operations.';
  } else if (intentCategory === 'Software Development') {
    reasoning += '. Activity suggests software development or coding.';
  } else if (intentCategory === 'Media Consumption') {
    reasoning += '. Activity suggests leisure or entertainment.';
  } else if (intentCategory === 'Learning / Research') {
    reasoning += '. Activity suggests learning or research.';
  } else if (intentCategory === 'Context Switching') {
    reasoning += '. Brief system interaction detected.';
  }

  return {
    category: intentCategory,
    confidence: Math.round(confidence * 100) / 100,
    reasoning,
    app_type: appType
  };
}

// Analyze session for overall intent
export function analyzeSession(events: any[]): IntentResult {
  const categoryCounts: { [key: string]: number } = {};
  let totalDuration = 0;

  for (const event of events) {
    if (event.app_package && event.duration_ms) {
      const intent = inferIntent(event.app_package, event.app_label || '', event.duration_ms);
      if (intent) {
        categoryCounts[intent.category] = (categoryCounts[intent.category] || 0) + event.duration_ms;
        totalDuration += event.duration_ms;
      }
    }
  }

  // Find dominant category
  let dominantCategory = 'Unknown / Mixed';
  let maxDuration = 0;

  for (const [category, duration] of Object.entries(categoryCounts)) {
    if (duration > maxDuration) {
      maxDuration = duration;
      dominantCategory = category;
    }
  }

  // Calculate confidence based on how dominant the category is
  const confidence = totalDuration > 0 ? Math.min(maxDuration / totalDuration, 0.95) : 0.5;

  return {
    category: dominantCategory,
    confidence: Math.round(confidence * 100) / 100,
    reasoning: `Based on ${events.length} events over ${Math.round(totalDuration / 60000)} minutes. Primary activity: ${dominantCategory}.`,
    app_type: 'session'
  };
}
