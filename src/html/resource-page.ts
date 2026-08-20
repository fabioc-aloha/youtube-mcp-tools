import type { CollateralDocument } from '../collateral/types.js';
import type { ResearchCollection } from '../research/types.js';

export function renderResourcePage(
    collection: ResearchCollection,
    collateral: CollateralDocument,
): string {
    const sections = collateral.sections.map((section) => `
        <section>
          <h2>${escapeHtml(section.heading)}</h2>
          ${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n')}
        </section>`).join('\n');
    const videos = collection.selected.map((candidate) => {
        const evidence = candidate.evidence
            .filter((item) => item.passed)
            .map((item) => `<li><strong>${escapeHtml(item.criterion)}:</strong> ${escapeHtml(item.detail)}</li>`)
            .join('\n');
        return `
          <article class="video-card">
            <h3><a href="${escapeAttribute(candidate.video.url)}">${escapeHtml(candidate.video.title)}</a></h3>
            <p class="meta">${escapeHtml(candidate.video.channel)} · ${escapeHtml(candidate.video.publishedAt.slice(0, 10))}</p>
            <p>${escapeHtml(selectionRationale(candidate))}</p>
            <ul>${evidence}</ul>
          </article>`;
    }).join('\n');
    const questions = collateral.studyQuestions && collateral.studyQuestions.length > 0
        ? `<section><h2>Study questions</h2><ol>${collateral.studyQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join('')}</ol></section>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(collateral.title)}</title>
  <script>
  (() => {
    const param = new URLSearchParams(window.location.search).get("scoutTheme");
    const theme =
      param || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  })();
  </script>
  <style>
  :root {
    color-scheme: light;
    --cp-bg: #f7f4ef;
    --cp-bg-elevated: #fcfbf8;
    --cp-surface: #ffffff;
    --cp-surface-soft: #f5f5f5;
    --cp-border: #dedede;
    --cp-border-strong: #919191;
    --cp-text: #242424;
    --cp-text-muted: #5c5c5c;
    --cp-text-soft: #6f6f6f;
    --cp-accent: #b11f4b;
    --cp-accent-hover: #9a1a41;
    --cp-accent-soft: rgba(177, 31, 75, 0.08);
    --cp-accent-fg: #ffffff;
    --cp-success: #16a34a;
    --cp-danger: #dc2626;
    --cp-warning: #f59e0b;
    --cp-link: #0078d4;
    --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.12);
    --cp-overlay: rgba(255, 255, 255, 0.8);
    --cp-panel: rgba(255, 255, 255, 0.86);
    --cp-panel-strong: rgba(255, 255, 255, 0.96);
    --cp-sheen: rgba(255, 255, 255, 0.55);
    --cp-highlight: rgba(177, 31, 75, 0.12);
  }
  html[data-theme="dark"] {
    color-scheme: dark;
    --cp-bg: #3d3b3a;
    --cp-bg-elevated: #343231;
    --cp-surface: #292929;
    --cp-surface-soft: #2e2e2e;
    --cp-border: #474747;
    --cp-border-strong: #5f5f5f;
    --cp-text: #dedede;
    --cp-text-muted: #919191;
    --cp-text-soft: #b0b0b0;
    --cp-accent: #fd8ea1;
    --cp-accent-hover: #fb7b91;
    --cp-accent-soft: rgba(253, 142, 161, 0.14);
    --cp-accent-fg: #1a1a1a;
    --cp-success: #4ade80;
    --cp-danger: #f87171;
    --cp-warning: #fbbf24;
    --cp-link: #4da6ff;
    --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
    --cp-overlay: rgba(41, 41, 41, 0.88);
    --cp-panel: rgba(41, 41, 41, 0.72);
    --cp-panel-strong: rgba(41, 41, 41, 0.96);
    --cp-sheen: rgba(255, 255, 255, 0.04);
    --cp-highlight: rgba(253, 142, 161, 0.12);
  }
  body { background: var(--cp-bg); color: var(--cp-text); font-family: "Segoe UI", Aptos, Calibri, -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; margin: 0; }
  main { margin: 0 auto; max-width: 70rem; padding: 2rem 1.5rem 4rem; }
  header, section, .video-card { background: var(--cp-surface); border: 1px solid var(--cp-border); border-radius: 1rem; margin-bottom: 1rem; padding: 1.5rem; }
  h1, h2, h3 { line-height: 1.2; }
  h1 { margin-top: 0; }
  a { color: var(--cp-link); }
  .standfirst, .meta { color: var(--cp-text-muted); }
  .video-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); }
  .video-card { margin: 0; }
  .method { background: var(--cp-accent-soft); border-color: var(--cp-border-strong); }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="meta">Curated video research · Verified ${escapeHtml(collection.generatedAt.slice(0, 10))}</p>
      <h1>${escapeHtml(collateral.title)}</h1>
      <p class="standfirst">${escapeHtml(collateral.standfirst)}</p>
    </header>
    <section class="method">
      <h2>How these videos were selected</h2>
      <p>${escapeHtml(collection.selectionMethod)}</p>
    </section>
    <section>
      <h2>Selected videos</h2>
      <div class="video-grid">${videos}</div>
    </section>
    ${sections}
    ${questions}
    <section>
      <h2>Source note</h2>
      <p>${escapeHtml(collateral.sourceNote)}</p>
    </section>
  </main>
</body>
</html>`;
}

function selectionRationale(candidate: ResearchCollection['selected'][number]): string {
    const terms = candidate.matchedTopicTerms.join(', ') || 'No direct topic terms';
    const coverage = candidate.coveredAreas.join(', ') || 'No requested coverage areas';
    return `Matched topic terms: ${terms}. Contributes to: ${coverage}.`;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[character] ?? character);
}

function escapeAttribute(value: string): string {
    return escapeHtml(value);
}
