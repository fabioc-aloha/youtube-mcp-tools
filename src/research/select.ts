import {
    type EvidenceItem,
    type EvaluatedVideo,
    type ResearchBrief,
    type ResearchCollection,
    type VideoCandidate,
} from './types.js';

const TOPIC_WEIGHT = 0.5;
const COVERAGE_WEIGHT = 0.3;
const QUALITY_WEIGHT = 0.2;

export function selectResearchCollection(
    brief: ResearchBrief,
    candidates: VideoCandidate[],
): ResearchCollection {
    validateBrief(brief);

    const evaluated = candidates.map((candidate) => evaluateCandidate(brief, candidate));
    const eligible = evaluated
        .filter((candidate) => candidate.evidence.every((item) => item.passed || item.criterion === 'Recency target'))
        .sort((left, right) => right.selectionScore - left.selectionScore);

    return {
        brief,
        selected: eligible.slice(0, brief.maxSelections),
        excluded: evaluated
            .filter((candidate) => !eligible.includes(candidate) || !eligible.slice(0, brief.maxSelections).includes(candidate))
            .sort((left, right) => right.selectionScore - left.selectionScore),
        generatedAt: brief.asOf,
        selectionMethod: 'Explicit relevance, coverage, transcript availability, duration, source identity, and recency evidence. Selection scores are weighted, inspectable totals rather than opaque quality ratings.',
    };
}

export function evaluateCandidate(brief: ResearchBrief, video: VideoCandidate): EvaluatedVideo {
    const topicTerms = terms(brief.topic);
    const searchableText = `${video.title} ${video.tags?.join(' ') ?? ''} ${video.transcript ?? ''}`;
    const normalizedText = normalize(searchableText);
    const matchedTopicTerms = topicTerms.filter((term) => normalizedText.includes(term));
    const coveredAreas = brief.requiredCoverage.filter((area) =>
        terms(area).some((term) => normalizedText.includes(term)),
    );
    const evidence = buildEvidence(brief, video, matchedTopicTerms, coveredAreas);
    const relevanceScore = topicTerms.length === 0 ? 0 : matchedTopicTerms.length / topicTerms.length;
    const coverageScore = brief.requiredCoverage.length === 0 ? 1 : coveredAreas.length / brief.requiredCoverage.length;
    const qualityScore = evidence.filter((item) => item.passed).length / evidence.length;

    return {
        video,
        relevanceScore,
        qualityScore,
        selectionScore: relevanceScore * TOPIC_WEIGHT + coverageScore * COVERAGE_WEIGHT + qualityScore * QUALITY_WEIGHT,
        matchedTopicTerms,
        coveredAreas,
        evidence,
    };
}

function buildEvidence(
    brief: ResearchBrief,
    video: VideoCandidate,
    matchedTopicTerms: string[],
    coveredAreas: string[],
): EvidenceItem[] {
    const evidence: EvidenceItem[] = [
        {
            criterion: 'Transcript availability',
            passed: Boolean(video.transcript?.trim()),
            detail: video.transcript?.trim()
                ? 'Transcript is available for grounded analysis and citation.'
                : 'No transcript is available, so the video cannot support transcript-grounded collateral.',
        },
        {
            criterion: 'Topic relevance',
            passed: matchedTopicTerms.length > 0,
            detail: matchedTopicTerms.length > 0
                ? `Matched topic terms: ${matchedTopicTerms.join(', ')}.`
                : 'No topic terms matched the available title, tags, or transcript.',
        },
        {
            criterion: 'Required coverage',
            passed: coveredAreas.length > 0,
            detail: coveredAreas.length > 0
                ? `Contributes to: ${coveredAreas.join(', ')}.`
                : 'Does not contribute to a requested coverage area.',
        },
        {
            criterion: 'Identifiable source',
            passed: Boolean(video.channel.trim() && video.url.trim()),
            detail: video.channel.trim() && video.url.trim()
                ? `Published by ${video.channel} and linked to its source video.`
                : 'The video is missing a channel name or source URL.',
        },
        {
            criterion: 'Practical duration',
            passed: video.durationSeconds >= 180 && video.durationSeconds <= 14_400,
            detail: `Runtime: ${formatDuration(video.durationSeconds)}.`,
        },
    ];

    if (brief.recencyTargetYears !== undefined) {
        const ageInYears = ageYears(video.publishedAt, brief.asOf);
        evidence.push({
            criterion: 'Recency target',
            passed: ageInYears <= brief.recencyTargetYears,
            detail: `${ageInYears.toFixed(1)} years old; target is ${brief.recencyTargetYears} years or newer.`,
        });
    }

    return evidence;
}

function validateBrief(brief: ResearchBrief): void {
    if (!brief.topic.trim()) {
        throw new Error('A research topic is required.');
    }
    if (!brief.audience.trim()) {
        throw new Error('A target audience is required.');
    }
    if (!Number.isInteger(brief.maxSelections) || brief.maxSelections < 1) {
        throw new Error('maxSelections must be a positive integer.');
    }
    if (Number.isNaN(Date.parse(brief.asOf))) {
        throw new Error('asOf must be an ISO 8601 date.');
    }
}

function terms(text: string): string[] {
    return [...new Set(normalize(text).split(' ').filter((term) => term.length > 2))];
}

function normalize(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function ageYears(publishedAt: string, asOf: string): number {
    const milliseconds = Date.parse(asOf) - Date.parse(publishedAt);
    return Math.max(0, milliseconds / (365.25 * 24 * 60 * 60 * 1000));
}

function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
