# arxiv-cli

Terminal interface for [arxiv-coach](https://github.com/mindofindica/arxiv-coach) — query papers, check knowledge gaps, and search from the command line.

## Installation

```bash
npm install -g @indica/arxiv-cli

# Or use locally via npx
npx @indica/arxiv-cli stats
```

## Prerequisites

arxiv-coach must be installed and have run at least once to populate the database.

Default database location: `/root/.openclaw/state/arxiv-coach/arxiv.db`

## Usage

```bash
arxiv <command> [options]
```

### Commands

**`arxiv today`**
Show papers discovered today with LLM relevance scores.

```bash
$ arxiv today

📚 Papers discovered today (5):

1. [4/5] Scaling Laws for Mixture of Experts
   arXiv:2402.09821

2. [4/5] Gemini 1.5: Unlocking multimodal understanding across millions...
   arXiv:2403.05530
```

**`arxiv recent [days]`**
Show papers from the last N days (default: 3), grouped by discovery date.

```bash
$ arxiv recent 7
```

**`arxiv explain <id|query>`**
View full details for a paper by arXiv ID or title substring.

```bash
$ arxiv explain 2402.09817
$ arxiv explain "mixture of experts"

📄 Scaling Laws for Mixture of Experts
   arXiv:2402.09817
   Authors: OpenAI Research Team
   Published: 2024-02-15
   Score: 4/5
   Track: llm-engineering

📝 Abstract:
We study scaling laws for Mixture of Experts (MoE) models...

💡 To get an explanation, use Signal and send:
   /explain 2402.09817
```

**`arxiv gaps`**
List tracked knowledge gaps with mention counts and last occurrence.

```bash
$ arxiv gaps

🧩 Knowledge Gaps (3):

1. Sparse attention mechanisms
   Mentioned: 5 time(s)
   Last: 2 days ago

2. Constitutional AI
   Mentioned: 3 time(s)
   Last: Yesterday
```

**`arxiv search <query>`**
Search papers by title or abstract with highlighted snippets.

```bash
$ arxiv search transformers

🔍 Search results for "transformers" (12):

1. [5/5] Attention Is All You Need
   arXiv:1706.03762 • 1 year ago
   ...introduce a new simple network architecture, the Transformer...
```

**`arxiv stats`**
Database statistics: total papers, scoring coverage, tracks, recent activity.

```bash
$ arxiv stats

📊 arxiv-coach Statistics:

  Total papers: 287
  Scored papers: 287 (100%)
  Average score: 3.2
  High-quality (≥4): 89
  Knowledge gaps: 12

  Papers by track:
    llm-engineering: 156
    agents: 78
    multimodal: 53

  Last 7 days:
    2026-02-15: 8 papers
    2026-02-14: 12 papers
    2026-02-13: 10 papers
```

### Options

- `--db <path>` — Custom database path
- `--help`, `-h` — Show help
- `--version`, `-v` — Show version

## Examples

```bash
# Morning routine: check overnight discoveries
arxiv today

# Weekly review
arxiv recent 7

# Dive deep into a specific paper
arxiv explain "constitutional ai"

# Find all papers on a topic
arxiv search "retrieval augmented generation"

# Track knowledge gaps
arxiv gaps

# Check collection health
arxiv stats
```

## Features

- ✅ **Fast queries** — Direct SQLite access, no API calls
- 🎨 **Clean output** — Formatted for terminal readability
- 🔍 **Fuzzy matching** — Find papers by partial titles
- 📊 **Rich statistics** — Track learning over time
- 🧩 **Gap tracking** — Monitor what you need to learn
- 📅 **Timeline view** — See discovery patterns

## Database Schema

The CLI reads directly from arxiv-coach's SQLite database:

```sql
-- Papers table
CREATE TABLE papers (
  arxiv_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT,
  abstract TEXT,
  published_at INTEGER,
  discovered_at INTEGER,
  track TEXT,
  score INTEGER, -- 1-5 LLM relevance score
  pdf_path TEXT
);

-- Knowledge gaps
CREATE TABLE gaps (
  id INTEGER PRIMARY KEY,
  topic TEXT NOT NULL,
  description TEXT,
  mention_count INTEGER DEFAULT 1,
  last_mentioned_at INTEGER
);
```

## Workflow Integration

### Morning Routine

```bash
#!/bin/bash
# morning-check.sh
echo "☀️  Morning arXiv Check"
echo ""
arxiv today
echo ""
arxiv gaps | head -10
```

### Weekly Deep Dive

```bash
# Filter high-quality papers from this week
arxiv recent 7 | grep '\[4/5\]\|\[5/5\]'
```

### Research Mode

```bash
# Find everything on a topic
arxiv search "attention mechanisms" > research-attention.txt
```

## Development

```bash
git clone https://github.com/mindofindica/arxiv-cli
cd arxiv-cli
npm install
npm link  # Install globally for development

# Test commands
arxiv stats
arxiv today
```

## Roadmap

- [ ] Export papers to BibTeX
- [ ] Integration with arxiv-coach `/explain` command
- [ ] Interactive mode with paper recommendations
- [ ] Custom filters (score threshold, date ranges)
- [ ] Export to Markdown/JSON
- [ ] Sync with Zotero/Obsidian

## License

MIT © [Indica](https://github.com/mindofindica)

---

Built to complement [arxiv-coach](https://github.com/mindofindica/arxiv-coach) — daily arXiv discovery pipeline with LLM scoring.
