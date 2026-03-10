# Meet Guide

An AI-powered meeting intelligence platform that transforms meeting transcripts into actionable insights through advanced natural language processing, cultural analysis, and professional development tracking.

## Overview

Meet Guide is a comprehensive meeting analysis system that helps teams and individuals improve communication, track action items, and foster inclusive workplace culture. The platform combines multiple AI systems to provide deep insights into meeting dynamics, pronunciation patterns, and cultural sensitivity.

## Architecture & Repository Structure

### Repository Overview

This monorepo contains both frontend and backend systems organized for independent development and deployment.

The project consists of two main components:

### Frontend: `meet-guide-app/`

- **Framework**: Next.js 16.0.6 with React 19.2
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Port**: 4001

### Backend: `meet-guide-server/`

Multiple specialized AI systems for comprehensive meeting analysis:

- **Meeting Summarization System** - Intent detection and action item extraction
- **Mispronunciation Detection System** - Speech analysis and pronunciation feedback
- **Cultural Analysis System** - Diversity and inclusion insights
- **Hybrid Detection System** - Detect genz slangs and give professional score

## Key Features

### For Individual Contributors

- **Action Item Tracking**: Never miss a commitment with AI-extracted tasks
- **Pronunciation Feedback**: Improve communication with personalized insights
- **Professional Scores**: Gives professional score base on genz slang usage
- **Intent Highlights**: Quick summaries of key discussion points

### For Managers

- **Team Meeting Dashboard**: Overview of all team meetings
- **Cultural Analysis**: Diversity and inclusion metrics
- **Meeting Analytics**: Participation patterns and engagement trends
- **Export Reports**: Generate comprehensive meeting summaries

## Getting Started

### Prerequisites

- **Node.js** 20+ (for frontend)
- **Python** 3.8+ (for backend systems)
- **Git** for version control

### Installation

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd meet-guide
```

#### 2. Setup Frontend (Next.js App)

```bash
cd meet-guide-app
npm install
npm run dev
```

Frontend will be available at: `http://localhost:4001`

#### 3. Setup Backend Systems

**Meeting Summarization System:**

```bash
cd meet-guide-server/meeting-summarization-system
pip install -r requirements.txt
python -m spacy download en_core_web_trf
python web_server.py
```

API available at: `http://127.0.0.1:8000`

**Mispronunciation Detection System:**

```bash
cd meet-guide-server/mispronunciation-detection-system
pip install -r requirements.txt
# Follow system-specific setup in the directory
```

**Cultural Analysis System:**

```bash
cd meet-guide-server/cultural-analysis-system
# Review prompts and integration guidelines
```

**Hybrid Detection System:**

```bash
cd meet-guide-server/hybrid-detection-system
python demo.py
```

## Project Structure

```
meet-guide/
├── meet-guide-app/              # Next.js Frontend Application
│   ├── app/
│   │   ├── (dashboard)/         # User dashboard routes
│   │   │   ├── dashboard/       # Main dashboard
│   │   │   ├── meetings/        # Meeting list & details
│   │   │   └── settings/        # User settings
│   │   ├── auth/                # Authentication pages
│   │   │   ├── login/           # Login components
│   │   │   └── signup/          # Registration
│   │   ├── management/          # Manager dashboard
│   │   │   ├── dashboard/       # Team overview
│   │   │   ├── meetings/        # Team meetings
│   │   │   └── settings/        # Team settings
│   │   └── page.tsx             # Landing page
│   ├── components/              # Reusable React components
│   │   ├── dashboard/           # Dashboard widgets
│   │   ├── home/                # Landing page sections
│   │   └── meetings/            # Meeting components
│   └── public/                  # Static assets
│
└── meet-guide-server/           # Python Backend Services
    ├── meeting-summarization-system/
    │   ├── main.py              # Core NLP pipeline
    │   ├── web_server.py        # FastAPI server
    │   └── models/              # Trained ML models
    ├── mispronunciation-detection-system/
    │   ├── phoneme_pronunciation_detector.py
    │   ├── confidence_pronunciation_detector.py
    │   └── whisper_finetuned_transcribe.py
    ├── cultural-analysis-system/
    │   └── prompts/             # LLM prompts for analysis
    └── hybrid-detection-system/
        └── hybrid_detector.py   # Meeting format detection
```

## User Flows

### Individual User Journey

1. **Login** → Secure authentication
2. **Dashboard** → View personal meeting insights
3. **Meetings** → Browse meeting history
4. **Meeting Details** → Deep dive into specific meetings
   - Action items assigned to you
   - Intent highlights from discussions
   - Professional participation scores
5. **Settings** → Configure preferences

### Manager Journey

1. **Management Dashboard** → Team-level analytics
2. **Team Meetings** → All team meeting insights
3. **Cultural Analysis** → Diversity metrics and inclusion insights
4. **Export Reports** → Generate team summaries

## Configuration

### Frontend Configuration

**Port Configuration** (`meet-guide-app/package.json`):

```json
{
  "scripts": {
    "dev": "next dev -H localhost -p 4001"
  }
}
```

### Backend Configuration

Each backend system has its own configuration:

- **Meeting Summarization**: Edit `web_server.py` for CORS origins
- **Pronunciation Detection**: Configure thresholds in detector files
- **Cultural Analysis**: Update prompts in `prompts/system/`

## 🧪 Testing

### Frontend

```bash
cd meet-guide-app
npm run lint
```

### Backend

```bash
# Test meeting summarization
cd meet-guide-server/meeting-summarization-system
python web_server.py  # Start server
# Use sample_transcript.json for testing

# Test hybrid detection
cd meet-guide-server/hybrid-detection-system
python demo.py
```

## Tech Stack

### Frontend

| Technology   | Version | Purpose                  |
| ------------ | ------- | ------------------------ |
| Next.js      | 16.0.6  | React framework with SSR |
| React        | 19.2.0  | UI library               |
| TypeScript   | 5.x     | Type safety              |
| Tailwind CSS | 4.1.17  | Styling                  |
| Lucide React | 0.555.0 | Icon library             |

### Backend

| Technology   | Purpose                       |
| ------------ | ----------------------------- |
| FastAPI      | RESTful API framework         |
| spaCy        | NLP and NER                   |
| Transformers | BERT-based models             |
| PyTorch      | Deep learning                 |
| Whisper      | Speech recognition            |
| dateparser   | Natural language date parsing |

## Security Considerations

- Authentication required for all dashboard routes
- API endpoints secured with CORS policies
- Sensitive data encrypted in transit
- User data isolation in multi-tenant architecture

## Deployment

### Frontend (Next.js)

```bash
cd meet-guide-app
npm run build
npm run start  # Production server
```

### Backend Services

Deploy each system independently:

```bash
# Meeting Summarization API
cd meet-guide-server/meeting-summarization-system
uvicorn web_server:app --host 0.0.0.0 --port 8000
```

**Recommended Setup:**

- Frontend: Vercel, Netlify, or AWS Amplify
- Backend: Docker containers on AWS ECS, Google Cloud Run, or Azure Container Instances
- Database: PostgreSQL for user data, vector store for embeddings

## Performance

- **Frontend**: Lighthouse score 90+ (optimized Next.js)
- **Intent Detection**: ~50-100ms per sentence (GPU)
- **Action Item Extraction**: Real-time processing for 1000+ sentence meetings
- **Pronunciation Analysis**: Batch processing with confidence scoring

## Troubleshooting

### Common Issues

**Frontend:**

- Port 4001 already in use: Change port in package.json
- Module not found: Run `npm install`

**Backend:**

- spaCy model missing: `python -m spacy download en_core_web_trf`
- CUDA errors: Set device to "cpu" in model loading
- Windows library conflicts: Set `KMP_DUPLICATE_LIB_OK=TRUE`

## Roadmap

- [ ] Real-time meeting transcription integration
- [ ] Advanced sentiment analysis
- [ ] Multi-language support
- [ ] Mobile application (iOS/Android)
- [ ] Calendar integration (Google/Outlook)
- [ ] Slack/Teams notifications
- [ ] Custom vocabulary training
- [ ] Video meeting integration

## Git Workflow & Merge Records

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Individual feature branches
- `hotfix/*` - Emergency fixes

### Merge History

| Date       | Branch         | Type  | Description                           |
| ---------- | -------------- | ----- | ------------------------------------- |
| 2025-12-02 | Initial Commit | Setup | Project structure initialized         |

**Note**: Complete merge history is available in Git logs:

```bash
git log --merges --pretty=format:"%h - %an, %ar : %s"
```

### Development Workflow

1. Create feature branch from `develop`
2. Implement changes with atomic commits
3. Test locally (frontend + backend)
4. Create pull request to `develop`
5. Code review and approval
6. Merge to `develop`
7. Periodic releases to `main`

## Contributing

This is an internal project. For questions or contributions, contact the development team.

### Contribution Guidelines

1. Follow the Git workflow above
2. Write descriptive commit messages
3. Update documentation for new features
4. Test all changes before PR submission
5. Document merge records in this README

## License

Proprietary - Meet Guide Platform © 2026

## Team

Meet Guide Development Team
