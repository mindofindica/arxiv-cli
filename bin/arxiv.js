#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

// Default path to arxiv-coach database
const DEFAULT_DB_PATH = '/root/.openclaw/state/arxiv-coach/arxiv.db';

function usage() {
  console.log(`
arxiv-cli v${pkg.version} - Terminal interface for arxiv-coach

USAGE:
  arxiv <command> [options]

COMMANDS:
  today              Show today's digest (papers discovered today)
  recent [days]      Show papers from last N days (default: 3)
  explain <id>       Explain a paper (by arXiv ID or title substring)
  gaps               Show tracked knowledge gaps
  search <query>     Search papers by title or abstract
  stats              Show database statistics

OPTIONS:
  --db <path>        Path to arxiv-coach database (default: ${DEFAULT_DB_PATH})
  --help, -h         Show this help message
  --version, -v      Show version

EXAMPLES:
  arxiv today
  arxiv recent 7
  arxiv explain 2402.09817
  arxiv explain "language model"
  arxiv search transformers
  arxiv gaps
`);
}

function formatDate(timestamp) {
  const d = new Date(timestamp);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toISOString().split('T')[0];
}

function truncate(str, maxLen = 80) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
}

function getDb(dbPath = DEFAULT_DB_PATH) {
  try {
    return new Database(dbPath, { readonly: true });
  } catch (err) {
    console.error(`❌ Failed to open database at ${dbPath}`);
    console.error(`   ${err.message}`);
    console.error(`\nMake sure arxiv-coach is set up and has run at least once.`);
    process.exit(1);
  }
}

function cmdToday(db) {
  const today = new Date().toISOString().split('T')[0];
  const papers = db.prepare(`
    SELECT arxiv_id, title, score, discovered_at 
    FROM papers 
    WHERE DATE(discovered_at / 1000, 'unixepoch') = ?
    ORDER BY score DESC, discovered_at DESC
  `).all(today);

  if (papers.length === 0) {
    console.log(`📭 No papers discovered today yet.`);
    return;
  }

  console.log(`\n📚 Papers discovered today (${papers.length}):\n`);
  papers.forEach((p, i) => {
    const score = p.score ? `[${p.score}/5]` : '[unscored]';
    console.log(`${i + 1}. ${score} ${truncate(p.title, 70)}`);
    console.log(`   arXiv:${p.arxiv_id}\n`);
  });
}

function cmdRecent(db, days = 3) {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const papers = db.prepare(`
    SELECT arxiv_id, title, score, discovered_at 
    FROM papers 
    WHERE discovered_at >= ?
    ORDER BY discovered_at DESC, score DESC
  `).all(cutoff);

  if (papers.length === 0) {
    console.log(`📭 No papers found in the last ${days} days.`);
    return;
  }

  console.log(`\n📚 Papers from last ${days} days (${papers.length}):\n`);
  
  let lastDate = null;
  papers.forEach((p) => {
    const date = formatDate(p.discovered_at);
    if (date !== lastDate) {
      console.log(`\n─── ${date} ───\n`);
      lastDate = date;
    }
    const score = p.score ? `[${p.score}/5]` : '[unscored]';
    console.log(`  ${score} ${truncate(p.title, 70)}`);
    console.log(`  arXiv:${p.arxiv_id}\n`);
  });
}

function cmdExplain(db, query) {
  if (!query) {
    console.error('❌ Please provide an arXiv ID or title substring');
    console.error('   Example: arxiv explain 2402.09817');
    console.error('   Example: arxiv explain "language model"');
    process.exit(1);
  }

  // Try exact arXiv ID match first
  let paper = db.prepare('SELECT * FROM papers WHERE arxiv_id = ?').get(query);
  
  // Try substring match on title
  if (!paper) {
    const matches = db.prepare(`
      SELECT * FROM papers 
      WHERE title LIKE ? OR abstract LIKE ?
      ORDER BY score DESC, discovered_at DESC
      LIMIT 5
    `).all(`%${query}%`, `%${query}%`);
    
    if (matches.length === 0) {
      console.log(`❌ No papers found matching "${query}"`);
      return;
    }
    
    if (matches.length > 1) {
      console.log(`\n🔍 Multiple matches found for "${query}":\n`);
      matches.forEach((m, i) => {
        console.log(`${i + 1}. [arXiv:${m.arxiv_id}] ${truncate(m.title, 60)}`);
      });
      console.log(`\nUse the arXiv ID for exact match: arxiv explain ${matches[0].arxiv_id}`);
      return;
    }
    
    paper = matches[0];
  }

  console.log(`\n📄 ${paper.title}`);
  console.log(`   arXiv:${paper.arxiv_id}`);
  console.log(`   Authors: ${paper.authors || 'N/A'}`);
  console.log(`   Published: ${new Date(paper.published_at).toISOString().split('T')[0]}`);
  console.log(`   Score: ${paper.score ? `${paper.score}/5` : 'unscored'}`);
  console.log(`   Track: ${paper.track || 'N/A'}`);
  console.log(`\n📝 Abstract:\n${paper.abstract}\n`);
  
  if (paper.pdf_path) {
    console.log(`📁 PDF: ${paper.pdf_path}`);
  }
  
  console.log(`\n💡 To get an explanation, use Signal and send:`);
  console.log(`   /explain ${paper.arxiv_id}`);
}

function cmdGaps(db) {
  const gaps = db.prepare(`
    SELECT * FROM gaps 
    ORDER BY last_mentioned_at DESC
  `).all();

  if (gaps.length === 0) {
    console.log(`✅ No knowledge gaps tracked yet.`);
    return;
  }

  console.log(`\n🧩 Knowledge Gaps (${gaps.length}):\n`);
  gaps.forEach((g, i) => {
    console.log(`${i + 1}. ${g.topic}`);
    if (g.description) {
      console.log(`   ${truncate(g.description, 80)}`);
    }
    console.log(`   Mentioned: ${g.mention_count} time(s)`);
    console.log(`   Last: ${formatDate(g.last_mentioned_at)}\n`);
  });
}

function cmdSearch(db, query) {
  if (!query) {
    console.error('❌ Please provide a search query');
    process.exit(1);
  }

  const results = db.prepare(`
    SELECT arxiv_id, title, score, discovered_at, abstract
    FROM papers
    WHERE title LIKE ? OR abstract LIKE ?
    ORDER BY score DESC, discovered_at DESC
    LIMIT 20
  `).all(`%${query}%`, `%${query}%`);

  if (results.length === 0) {
    console.log(`❌ No results found for "${query}"`);
    return;
  }

  console.log(`\n🔍 Search results for "${query}" (${results.length}):\n`);
  results.forEach((p, i) => {
    const score = p.score ? `[${p.score}/5]` : '[unscored]';
    console.log(`${i + 1}. ${score} ${truncate(p.title, 70)}`);
    console.log(`   arXiv:${p.arxiv_id} • ${formatDate(p.discovered_at)}`);
    
    // Show snippet of abstract with query highlighted
    const lowerAbstract = p.abstract.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerAbstract.indexOf(lowerQuery);
    if (idx !== -1) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(p.abstract.length, idx + query.length + 40);
      const snippet = (start > 0 ? '...' : '') + 
                     p.abstract.slice(start, end) + 
                     (end < p.abstract.length ? '...' : '');
      console.log(`   ${truncate(snippet, 80)}`);
    }
    console.log('');
  });
}

function cmdStats(db) {
  const total = db.prepare('SELECT COUNT(*) as count FROM papers').get().count;
  const scored = db.prepare('SELECT COUNT(*) as count FROM papers WHERE score IS NOT NULL').get().count;
  const tracks = db.prepare('SELECT track, COUNT(*) as count FROM papers WHERE track IS NOT NULL GROUP BY track ORDER BY count DESC').all();
  const avgScore = db.prepare('SELECT AVG(score) as avg FROM papers WHERE score IS NOT NULL').get().avg;
  const topScore = db.prepare('SELECT COUNT(*) as count FROM papers WHERE score >= 4').get().count;
  const gaps = db.prepare('SELECT COUNT(*) as count FROM gaps').get().count;
  
  console.log(`\n📊 arxiv-coach Statistics:\n`);
  console.log(`  Total papers: ${total}`);
  console.log(`  Scored papers: ${scored} (${Math.round(scored/total*100)}%)`);
  console.log(`  Average score: ${avgScore ? avgScore.toFixed(2) : 'N/A'}`);
  console.log(`  High-quality (≥4): ${topScore}`);
  console.log(`  Knowledge gaps: ${gaps}`);
  
  if (tracks.length > 0) {
    console.log(`\n  Papers by track:`);
    tracks.forEach(t => {
      console.log(`    ${t.track}: ${t.count}`);
    });
  }
  
  const recent = db.prepare(`
    SELECT DATE(discovered_at / 1000, 'unixepoch') as date, COUNT(*) as count
    FROM papers
    WHERE discovered_at >= ?
    GROUP BY date
    ORDER BY date DESC
    LIMIT 7
  `).all(Date.now() - (7 * 24 * 60 * 60 * 1000));
  
  if (recent.length > 0) {
    console.log(`\n  Last 7 days:`);
    recent.forEach(r => {
      console.log(`    ${r.date}: ${r.count} papers`);
    });
  }
  
  console.log('');
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  usage();
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log(pkg.version);
  process.exit(0);
}

const dbPath = args.includes('--db') ? args[args.indexOf('--db') + 1] : DEFAULT_DB_PATH;
const command = args[0];
const cmdArgs = args.slice(1).filter(a => !a.startsWith('--') && a !== dbPath);

const db = getDb(dbPath);

try {
  switch (command) {
    case 'today':
      cmdToday(db);
      break;
    case 'recent':
      cmdRecent(db, parseInt(cmdArgs[0]) || 3);
      break;
    case 'explain':
      cmdExplain(db, cmdArgs.join(' '));
      break;
    case 'gaps':
      cmdGaps(db);
      break;
    case 'search':
      cmdSearch(db, cmdArgs.join(' '));
      break;
    case 'stats':
      cmdStats(db);
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.error(`   Run 'arxiv --help' for usage`);
      process.exit(1);
  }
} finally {
  db.close();
}
