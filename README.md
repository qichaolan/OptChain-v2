# OptChain - AI-Powered Options Analysis

<img src="public/opt.png" alt="OptChain Logo" width="80" />

OptChain is an AI-powered stock options analysis tool built with Next.js, CopilotKit, and Google Gemini. It provides real-time options chain analysis with intelligent AI insights for various trading strategies.

**Live Demo**: [optchain.app](https://optchain.app/)
**Contact**: info@optchain.app

## Features

### Options Screeners
- **Chain Analysis** - Full options chain viewer with calls/puts, open interest visualization, and AI analysis
- **LEAPS Screener** - Long-term equity anticipation securities finder with ROI projections
- **Credit Spreads** - Bull put and bear call spread screener with ROC calculations
- **Iron Condors** - Iron condor strategy screener with probability of profit analysis

### AI Capabilities
- **AI Insights Panel** - Contextual AI analysis for any selected option or spread
- **Battle Mode** - Side-by-side AI comparison of two options contracts
- **Hover AI Tooltips** - Instant AI explanations when hovering over metrics (IV, Delta, etc.)
- **Micro Actions** - Quick AI actions like "Explain", "Summarize", "Compare"

## Architecture

```
OptChain/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── api/copilotkit/       # CopilotKit API endpoints
│   │   │   ├── route.ts          # Main CopilotKit handler
│   │   │   └── explain/          # AI explainer endpoint
│   │   ├── chain-analysis/       # Options chain analysis (home)
│   │   ├── leaps/                # LEAPS screener
│   │   ├── credit-spreads/       # Credit spreads screener
│   │   ├── iron-condors/         # Iron condors screener
│   │   └── layout.tsx            # Root layout with providers
│   │
│   ├── components/
│   │   ├── ai/                   # AI UI components
│   │   │   ├── AiInsightsButton.tsx
│   │   │   ├── AiInsightsPanel.tsx
│   │   │   ├── InlineAiInsights.tsx
│   │   │   ├── BattleModeComparison.tsx
│   │   │   ├── ChainBattleModeComparison.tsx
│   │   │   ├── HoverAI.tsx
│   │   │   ├── AiTooltip.tsx
│   │   │   └── MicroAiAction.tsx
│   │   ├── charts/               # Visualization components
│   │   │   └── OIMirrorBarChart.tsx
│   │   ├── wrappers/             # Page wrappers with AI
│   │   └── Navigation.tsx        # Shared navigation
│   │
│   ├── contexts/                 # React contexts
│   │   ├── CopilotProvider.tsx
│   │   └── OptionChainContext.tsx
│   │
│   ├── hooks/                    # Custom hooks
│   │   ├── useAiExplainer.ts
│   │   └── usePopoverPosition.ts
│   │
│   ├── lib/                      # Utilities
│   │   ├── gemini.ts             # Gemini AI client
│   │   ├── prompts.ts            # AI prompt templates
│   │   ├── validation.ts         # Zod schemas
│   │   └── options-utils.ts      # Options calculations
│   │
│   └── types/                    # TypeScript definitions
│       ├── context.ts            # Context envelope types
│       └── ai-response.ts        # AI response types
│
├── prompts/                      # AI prompt templates
│   ├── leaps/
│   ├── spreads/
│   ├── iron-condor/
│   └── micro-actions/
│
├── public/
│   └── opt.png                   # Logo
│
└── backend/                      # Python FastAPI backend
    └── app/
        └── main.py
```

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **AI Integration**: CopilotKit, Google Gemini 2.0
- **Backend**: Python FastAPI (options data API)
- **Visualization**: Recharts

## Setup

### Prerequisites

- Node.js 18+
- Python 3.9+ (for backend)
- Google Gemini API key

### Environment Variables

Create a `.env.local` file:

```env
# Required: Gemini API Key
GOOGLE_API_KEY=your-gemini-api-key

# Optional: Backend URL (defaults to localhost:8080)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080

# Optional: Gemini model (defaults to gemini-2.0-flash-exp)
GEMINI_MODEL=gemini-2.0-flash-exp
```

### Installation

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Development

```bash
# Terminal 1: Start the backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload

# Terminal 2: Start the frontend
npm run dev
```

The application will be available at `http://localhost:3001`.

## Usage

### Navigation

| Page | URL | Description |
|------|-----|-------------|
| Chain Analysis | `/chain-analysis` | Full options chain with AI analysis |
| LEAPS | `/leaps` | Long-term options screener |
| Credit Spreads | `/credit-spreads` | Credit spread finder |
| Iron Condors | `/iron-condors` | Iron condor screener |

### AI Features

1. **AI Insights Panel**: Click the "AI Insights" button on any page to get contextual analysis
2. **Battle Mode**: Compare two options side-by-side with AI analysis (available on LEAPS and Chain Analysis)
3. **Hover Tooltips**: Hover over metrics like IV, Delta, OI to get instant AI explanations
4. **Select & Analyze**: Click on any option row to load it into the AI context

## Deployment

### Docker

```bash
# Build the image
docker build -t optchain .

# Run the container
docker run -p 3001:3001 \
  -e GOOGLE_API_KEY=your-key \
  -e NEXT_PUBLIC_BACKEND_URL=https://your-backend.run.app \
  optchain
```

### GCP Cloud Run

```bash
# Build and push
docker build -t gcr.io/YOUR_PROJECT/optchain .
docker push gcr.io/YOUR_PROJECT/optchain

# Deploy
gcloud run deploy optchain \
  --image gcr.io/YOUR_PROJECT/optchain \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_API_KEY=your-key"
```

## API Reference

### Context Envelope

All pages use a standard context envelope for AI communication:

```typescript
interface ContextEnvelope<T> {
  page: 'chain_analysis' | 'leaps_ranker' | 'credit_spread_screener' | 'iron_condor_screener';
  contextType: 'roi_simulator' | 'spread_simulator' | 'options_analysis' | 'chain_analysis';
  metadata: T;
  settings: {
    theme: 'light' | 'dark';
    device: 'mobile' | 'desktop';
    locale?: string;
  };
  timestamp: string;
}
```

## Troubleshooting

### AI Not Responding
- Verify `GOOGLE_API_KEY` is set correctly
- Check Gemini API quotas in Google Cloud Console
- Review browser console for errors

### Backend Connection Issues
- Ensure FastAPI backend is running on port 8080
- Check `NEXT_PUBLIC_BACKEND_URL` environment variable
- Verify CORS settings in backend

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run build
```

## License

Proprietary - All rights reserved.
