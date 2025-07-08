// SEO utility functions for dynamic meta tag management

// Global gtag declaration for Google Analytics
declare global {
  function gtag(...args: any[]): void;
}

export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
}

export const defaultSEO: SEOConfig = {
  title: "GOAT Sailing Race - Multiplayer 2D Sailing Game | Realistic Physics & Strategy",
  description: "Experience authentic sailing tactics in this multiplayer 2D sailing race game featuring realistic wind physics, tactical gameplay, and competitive racing. Race up to 4 boats with advanced collision dynamics and weather simulation.",
  keywords: "sailing game, multiplayer sailing, boat racing, sailing simulation, wind physics, tactical sailing, competitive racing, 2D sailing, sailing tactics, marine sports game",
  image: "https://goatsailingrace.com/favicon.png",
  url: "https://goatsailingrace.com/",
  type: "website"
};

export const pageSEO: Record<string, SEOConfig> = {
  "/": {
    title: "GOAT Sailing Race - Play Free Multiplayer Sailing Game Online",
    description: "Race against opponents in this free multiplayer sailing game. Master wind tactics, boat positioning, and racing strategy in realistic 2D sailing simulator with up to 4 boats.",
    keywords: "free sailing game, online sailing race, multiplayer boat game, sailing simulator, wind tactics, racing strategy"
  },
  "/login": {
    title: "Login - GOAT Sailing Race | Access Your Sailing Account",
    description: "Sign in to your GOAT Sailing Race account to access multiplayer sailing races, track your racing statistics, and compete with sailors worldwide.",
    keywords: "sailing game login, sailing account, multiplayer sailing signin"
  },
  "/register": {
    title: "Create Account - GOAT Sailing Race | Join Free Sailing Community",
    description: "Join the GOAT Sailing Race community for free. Create your sailing account and start competing in multiplayer races with realistic sailing physics.",
    keywords: "sailing game signup, create sailing account, join sailing community, free sailing game registration"
  },
  "/profile": {
    title: "Your Sailing Profile - GOAT Sailing Race | Stats & Achievements",
    description: "View your sailing statistics, race history, and achievements. Track your progress and customize your boats in GOAT Sailing Race.",
    keywords: "sailing stats, racing profile, sailing achievements, boat customization"
  },
  "/forgot-password": {
    title: "Reset Password - GOAT Sailing Race | Recover Your Account",
    description: "Reset your GOAT Sailing Race account password. Secure account recovery to get back to multiplayer sailing races quickly.",
    keywords: "sailing account recovery, reset sailing password, forgot sailing login"
  },
  "/blog": {
    title: "GOAT Sailing Blog | Stories from the Water & Tech Insights",
    description: "Read stories from the sailing community, development insights, and updates from the GOAT Sailing Race team. From hackathon origins to competitive tournaments.",
    keywords: "sailing blog, sailing stories, game development, sailing community, regatta simulator, sailing tech"
  },
  "/blog/ai-hackathon-sailing-game": {
    title: "How an AI Hackathon Sailing Game Turned Into Paying Customers | GOAT Sailing Blog",
    description: "The story behind GOAT Sailing Race: from weekend hackathon project to hosting paid sailing tournaments. Learn how vibe coding and community focus created a successful sailing game.",
    keywords: "sailing game development, hackathon success story, sailing tournament, regatta simulator, sailing community, game development story"
  }
};

export function updatePageSEO(path: string): void {
  const config = { ...defaultSEO, ...pageSEO[path] };
  
  // Update title
  document.title = config.title;
  
  // Update meta description
  updateMetaTag('description', config.description);
  updateMetaTag('keywords', config.keywords || defaultSEO.keywords || '');
  
  // Update Open Graph tags
  updateMetaProperty('og:title', config.title);
  updateMetaProperty('og:description', config.description);
  updateMetaProperty('og:url', config.url || `https://goatsailingrace.com${path}`);
  updateMetaProperty('og:image', config.image || defaultSEO.image || '');
  updateMetaProperty('og:type', config.type || defaultSEO.type || 'website');
  
  // Update Twitter tags
  updateMetaProperty('twitter:title', config.title);
  updateMetaProperty('twitter:description', config.description);
  updateMetaProperty('twitter:url', config.url || `https://goatsailingrace.com${path}`);
  updateMetaProperty('twitter:image', config.image || defaultSEO.image || '');
  
  // Update canonical URL
  updateCanonicalURL(config.url || `https://goatsailingrace.com${path}`);
}

function updateMetaTag(name: string, content: string): void {
  let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function updateMetaProperty(property: string, content: string): void {
  let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function updateCanonicalURL(url: string): void {
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = url;
}

// Analytics tracking for SEO insights
export function trackPageView(path: string, title: string): void {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('config', 'GA_MEASUREMENT_ID', {
      page_title: title,
      page_location: `https://goatsailingrace.com${path}`
    });
  }
}

// Schema.org structured data for specific pages
export function addPageSchema(path: string): void {
  const existingSchema = document.querySelector('script[data-page-schema]');
  if (existingSchema) {
    existingSchema.remove();
  }

  let schema = null;
  
  switch (path) {
    case '/':
      schema = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "GOAT Sailing Race",
        "description": "Multiplayer 2D sailing race game with realistic physics",
        "url": "https://goatsailingrace.com/",
        "applicationCategory": "Game",
        "operatingSystem": "Cross-platform",
        "browserRequirements": "Requires JavaScript",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      };
      break;
    case '/login':
    case '/register':
      schema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": path === '/login' ? "Login" : "Register",
        "description": path === '/login' ? "Sign in to GOAT Sailing Race" : "Create your GOAT Sailing Race account",
        "url": `https://goatsailingrace.com${path}`,
        "isPartOf": {
          "@type": "WebSite",
          "name": "GOAT Sailing Race",
          "url": "https://goatsailingrace.com/"
        }
      };
      break;
  }

  if (schema) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-page-schema', 'true');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }
}