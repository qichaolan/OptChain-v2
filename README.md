# OptChain v2 - CopilotKit Integration

This is an experimental CopilotKit-enabled version of the OptionChain web application. It is a AI-powered stock option tools using CopilotKit and Google Gemini.

## Architecture

```
OptChain-v2/  (this repo - standalone)
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/
│   │   │   └── copilotkit/     # CopilotKit runtime endpoints
│   │   │       ├── route.ts    # Main CopilotKit handler
│   │   │       └── explain/    # AI explainer endpoint
│   │   ├── leaps/              # LEAPS page with AI
│   │   ├── credit-spreads/     # Credit Spreads page with AI
│   │   ├── iron-condors/       # Iron Condors page with AI
│   │   ├── layout.tsx          # Root layout with providers
│   │   └── page.tsx            # Home page
│   │
│   ├── components/
│   │   ├── ai/                 # AI UI components
│   │   │   ├── AiInsightsButton.tsx
│   │   │   └── AiInsightsPanel.tsx
│   │   └── wrappers/           # Page wrappers with AI integration
│   │       ├── LeapsPageWithAI.tsx
│   │       ├── CreditSpreadsPageWithAI.tsx
│   │       └── IronCondorPageWithAI.tsx
│   │
│   ├── contexts/               # React contexts
│   │   ├── CopilotProvider.tsx
│   │   └── OptionChainContext.tsx
│   │
│   ├── hooks/                  # Custom hooks
│   │   └── useAiExplainer.ts
│   │
│   ├── actions/                # CopilotKit actions
│   │   └── aiExplainerAction.ts
│   │
│   ├── types/                  # TypeScript definitions
│   │   ├── context.ts          # Context envelope types
│   │   └── ai-response.ts      # AI response types
│   │
│   └── utils/                  # Utility functions
│
├── prompts/                    # AI prompt templates
│   ├── leaps/
│   │   └── explainer.txt
│   ├── spreads/
│   │   └── explainer.txt
│   └── iron-condor/
│       └── explainer.txt
│
├── package.json
├── tsconfig.json
├── next.config.js
└── tailwind.config.js
```

## Key Features

1. Leaps screener
2. Credit Spreads Screener
3. Iron Condor Screener

## Context Envelope Standard

All pages use a standard context envelope format:

```typescript
interface ContextEnvelope<T> {
  page: 'leaps_ranker' | 'credit_spread_screener' | 'iron_condor_screener';
  contextType: 'roi_simulator' | 'spread_simulator';
  metadata: T;  // Page-specific simulation data
  settings: {
    theme: 'light' | 'dark';
    device: 'mobile' | 'desktop';
    locale?: string;
  };
  timestamp: string;
}
```

## Setup

### Prerequisites

- Node.js 18+
- Running FastAPI backend (port 8080)
- Google Gemini API key

### Environment Variables

Create a `.env.local` file:

```env
# Required: Gemini API Key
GOOGLE_API_KEY=your-gemini-api-key

# Optional: CopilotKit Cloud API Key
NEXT_PUBLIC_COPILOTKIT_API_KEY=your-copilotkit-key

# Optional: Backend URL (defaults to localhost:8080)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080

# Optional: Gemini model (defaults to gemini-2.0-flash-exp)
GEMINI_MODEL=gemini-2.0-flash-exp
```

### Installation

```bash
cd OptChain-v2
npm install
```

### Development

```bash
# Start the existing FastAPI backend first (from the sibling 'option' repo)
cd ../option/web
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload

# In another terminal, start OptChain-v2
cd ../OptChain-v2
npm run dev
```

The CopilotKit-enabled version will be available at `http://localhost:3001`.

## Usage

### Switching Between Versions

| Version | URL | Description |
|---------|-----|-------------|
| Original | `http://localhost:8080` | FastAPI + Jinja2 templates |
| OptChain-v2 | `http://localhost:3001` | React + CopilotKit |

### Using AI Insights

1. Navigate to any strategy page (LEAPS, Credit Spreads, Iron Condors)
2. Run a simulation using the existing UI
3. Click the "AI Insights" button (bottom-right)
4. View structured analysis in the slide-out panel

### Communication Between iframe and Wrapper

The existing pages can communicate with the wrapper using `postMessage`:

```javascript
// In existing page (e.g., credit_spreads.js)
window.parent.postMessage({
  type: 'CREDIT_SPREAD_SIMULATION_UPDATE',
  payload: {
    symbol: 'SPY',
    spreadType: 'PCS',
    shortStrike: 580,
    longStrike: 575,
    netCredit: 1.25,
    // ... other metadata
  }
}, '*');
```

## Deployment to GCP Cloud Run

### Build and Deploy

```bash
# Build the Docker image
docker build -t gcr.io/YOUR_PROJECT/optchain-v2 .

# Push to Container Registry
docker push gcr.io/YOUR_PROJECT/optchain-v2

# Deploy to Cloud Run
gcloud run deploy optchain-v2 \
  --image gcr.io/YOUR_PROJECT/optchain-v2 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_API_KEY=your-key,NEXT_PUBLIC_BACKEND_URL=https://your-backend.run.app"
```

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start"]
```

## Adding New Pages

1. Create a new page wrapper in `src/components/wrappers/`:

```typescript
'use client';

import { useOptionChain } from '@/contexts';
import { AiInsightsButton, AiInsightsPanel } from '@/components/ai';

export function NewPageWithAI({ pageUrl }: { pageUrl: string }) {
  const { setCurrentContext } = useOptionChain();

  // Handle messages from embedded page
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'NEW_PAGE_SIMULATION_UPDATE') {
        setCurrentContext('new_page_id', 'context_type', e.data.payload);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div className="relative w-full h-screen">
      <iframe src={pageUrl} className="w-full h-full" />
      <AiInsightsButton />
      <AiInsightsPanel />
    </div>
  );
}
```

2. Add the page route in `src/app/new-page/page.tsx`

3. Create a prompt template in `prompts/new-page/explainer.txt`

## Troubleshooting

### AI Insights Button Not Showing

- Ensure the embedded page is sending simulation data via `postMessage`
- Check browser console for errors
- Verify the context is being set in `OptionChainContext`

### Gemini API Errors

- Verify `GOOGLE_API_KEY` is set correctly
- Check rate limits in Gemini console
- Review API response in Network tab

### iframe Not Loading

- Ensure FastAPI backend is running on port 8080
- Check CORS settings in `main.py`
- Verify `X-Frame-Options` header allows embedding

## Future Enhancements

- [ ] Replace iframe with native React components
- [ ] Add real-time streaming for AI responses
- [ ] Implement conversation history
- [ ] Integrate with CopilotKit Cloud for analytics
- [ ] Add more option tools
- [ ] Add earning analysis


