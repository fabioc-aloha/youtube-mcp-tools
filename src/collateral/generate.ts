import type { ResearchCollection } from '../research/types.js';
import type {
    CollateralBrief,
    CollateralDocument,
    DirectCollateralProvider,
    DirectGenerationRequest,
    HostGenerationPrompt,
} from './types.js';

export function buildHostGenerationPrompt(
    collection: ResearchCollection,
    brief: CollateralBrief,
): HostGenerationPrompt {
    validateCollateralBrief(collection, brief);

    const sourceList = collection.selected
        .map((candidate) => `- ${candidate.video.title} — ${candidate.video.channel} (${candidate.video.url})`)
        .join('\n');
    const claims = brief.claims
        .map((claim) => {
            const citations = claim.citations.map((citation) => {
                const source = collection.selected.find((candidate) => candidate.video.id === citation.videoId);
                const timestamp = formatTimestamp(citation.timestampSeconds);
                return source
                    ? `${source.video.title} at ${timestamp}: ${citation.rationale}`
                    : `Unknown source ${citation.videoId} at ${timestamp}: ${citation.rationale}`;
            }).join('; ');
            return `- ${claim.claim}\n  Evidence: ${citations}`;
        })
        .join('\n');

    return {
        name: `youtube_write_${brief.kind.replace('-', '_')}`,
        description: `Write a source-grounded ${brief.kind} from a curated YouTube research collection.`,
        instructions: [
            `Write an original ${brief.kind} titled "${brief.title}" for ${brief.audience}.`,
            'Use only the grounded claims and source list below. Do not invent facts, credentials, outcomes, or citations.',
            'Paraphrase rather than quote transcript language. Do not reproduce long transcript passages.',
            'For every substantive claim, include a linked video citation with a timestamp when one is available.',
            'State material gaps or disagreements instead of forcing consensus.',
            'Return a title, a short standfirst, structured sections, and study questions when appropriate.',
            '',
            'Selected videos:',
            sourceList,
            '',
            'Grounded claims:',
            claims,
            '',
            'Learning objectives:',
            ...brief.learningObjectives.map((objective) => `- ${objective}`),
        ].join('\n'),
    };
}

export async function generateWithDirectProvider(
    provider: DirectCollateralProvider,
    collection: ResearchCollection,
    brief: CollateralBrief,
): Promise<CollateralDocument> {
    const prompt = buildHostGenerationPrompt(collection, brief);
    const request: DirectGenerationRequest = { collection, brief, prompt };
    return provider.generate(request);
}

function validateCollateralBrief(collection: ResearchCollection, brief: CollateralBrief): void {
    if (collection.selected.length === 0) {
        throw new Error('Collateral requires at least one selected video.');
    }
    if (!brief.title.trim() || !brief.audience.trim()) {
        throw new Error('Collateral requires a title and audience.');
    }
    if (brief.claims.length === 0) {
        throw new Error('Collateral requires at least one grounded claim.');
    }
    for (const claim of brief.claims) {
        if (!claim.claim.trim() || claim.citations.length === 0) {
            throw new Error('Each grounded claim requires text and at least one timestamp citation.');
        }
        for (const citation of claim.citations) {
            if (!collection.selected.some((candidate) => candidate.video.id === citation.videoId)) {
                throw new Error(`Citation references an unselected video: ${citation.videoId}.`);
            }
            if (!Number.isFinite(citation.timestampSeconds) || citation.timestampSeconds < 0) {
                throw new Error('Citation timestamps must be non-negative seconds.');
            }
        }
    }
}

function formatTimestamp(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}
