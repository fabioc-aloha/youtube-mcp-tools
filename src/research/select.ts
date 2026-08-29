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
    const eligible = evaluated.filter((candidate) =>
        candidate.evidence.every((item) => item.passed || item.criterion === 'Recency target'),
    );
    const selected = selectDiverse(eligible, brief.maxSelections);
    const selectedIds = new Set(selected.map((candidate) => candidate.video.id));

    return {
        brief,
        selected,
        excluded: evaluated.filter((candidate) => !selectedIds.has(candidate.video.id)).sort((a, b) => b.selectionScore - a.selectionScore),
        generatedAt: brief.asOf,
        selectionMethod: 'Explicit relevance, coverage, transcript availability, duration, source identity, recency, source diversity, redundancy reduction, and coverage optimization. Selection scores are weighted, inspectable totals rather than opaque quality ratings.',
        searchProvenance: [...new Set(candidates.map((candidate) => candidate.searchQuery).filter((query): query is string => Boolean(query)))],
        viewingSequence: buildViewingSequence(selected),
        complementarySources: findComplementarySources(selected),
        disagreements: findComparisonOpportunities(selected),
    };
}

export function evaluateCandidate(brief: ResearchBrief, video: VideoCandidate): EvaluatedVideo {
    const topicTerms = terms(brief.topic);
    const searchableText = `${video.title} ${video.tags?.join(' ') ?? ''} ${video.transcript ?? ''}`;
    const normalizedText = normalize(searchableText);
    const matchedTopicTerms = topicTerms.filter((term) => normalizedText.includes(term));
    const coveredAreas = brief.requiredCoverage.filter((area) => terms(area).some((term) => normalizedText.includes(term)));
    const evidence = buildEvidence(brief, video, matchedTopicTerms, coveredAreas);
    const relevanceScore = topicTerms.length === 0 ? 0 : matchedTopicTerms.length / topicTerms.length;
    const coverageScore = brief.requiredCoverage.length === 0 ? 1 : coveredAreas.length / brief.requiredCoverage.length;
    const qualityScore = evidence.filter((item) => item.passed).length / evidence.length;

    return {
        video, relevanceScore, qualityScore,
        selectionScore: relevanceScore * TOPIC_WEIGHT + coverageScore * COVERAGE_WEIGHT + qualityScore * QUALITY_WEIGHT,
        matchedTopicTerms, coveredAreas, evidence,
    };
}

function selectDiverse(candidates: EvaluatedVideo[], maxSelections: number): EvaluatedVideo[] {
    const remaining = [...candidates];
    const selected: EvaluatedVideo[] = [];
    const covered = new Set<string>();
    const channels = new Set<string>();
    while (remaining.length > 0 && selected.length < maxSelections) {
        remaining.sort((a, b) => diversityScore(b, covered, channels, selected) - diversityScore(a, covered, channels, selected));
        const next = remaining.shift();
        if (!next) break;
        selected.push(next);
        next.coveredAreas.forEach((area) => covered.add(area));
        channels.add(normalize(next.video.channel));
    }
    return selected;
}

function diversityScore(candidate: EvaluatedVideo, covered: Set<string>, channels: Set<string>, selected: EvaluatedVideo[]): number {
    const newCoverage = candidate.coveredAreas.filter((area) => !covered.has(area)).length;
    const sameChannelPenalty = channels.has(normalize(candidate.video.channel)) ? 0.12 : 0;
    const redundancyPenalty = selected.some((item) => similarity(item.video, candidate.video) >= 0.75) ? 0.35 : 0;
    return candidate.selectionScore + newCoverage * 0.15 - sameChannelPenalty - redundancyPenalty;
}

function similarity(left: VideoCandidate, right: VideoCandidate): number {
    const leftTerms = new Set(terms(`${left.title} ${left.tags?.join(' ') ?? ''}`));
    const rightTerms = new Set(terms(`${right.title} ${right.tags?.join(' ') ?? ''}`));
    const intersection = [...leftTerms].filter((term) => rightTerms.has(term)).length;
    const union = new Set([...leftTerms, ...rightTerms]).size;
    return union === 0 ? 0 : intersection / union;
}

function buildViewingSequence(selected: EvaluatedVideo[]): string[] {
    return [...selected].sort((a, b) => {
        const coverage = b.coveredAreas.length - a.coveredAreas.length;
        return coverage !== 0 ? coverage : a.video.durationSeconds - b.video.durationSeconds;
    }).map((candidate) => candidate.video.id);
}

function findComplementarySources(selected: EvaluatedVideo[]): Array<{ videoId: string; reason: string }> {
    if (selected.length < 2) return [];
    const primary = selected[0];
    return selected.slice(1).filter((candidate) =>
        candidate.coveredAreas.some((area) => !primary.coveredAreas.includes(area)) || candidate.video.channel !== primary.video.channel,
    ).map((candidate) => ({
        videoId: candidate.video.id,
        reason: candidate.video.channel !== primary.video.channel
            ? `Adds an independent source perspective from ${candidate.video.channel}.`
            : 'Adds coverage not fully represented by the primary selection.',
    }));
}

function findComparisonOpportunities(selected: EvaluatedVideo[]): Array<{ topic: string; videoIds: string[]; description: string }> {
    const opportunities: Array<{ topic: string; videoIds: string[]; description: string }> = [];
    for (let index = 0; index < selected.length; index += 1) {
        for (let other = index + 1; other < selected.length; other += 1) {
            const left = selected[index];
            const right = selected[other];
            const shared = left.coveredAreas.filter((area) => right.coveredAreas.includes(area));
            if (shared.length > 0 && normalize(left.video.title) !== normalize(right.video.title)) {
                opportunities.push({ topic: shared[0], videoIds: [left.video.id, right.video.id], description: 'Both sources address this coverage area; compare their explanations and evidence rather than assuming they are interchangeable.' });
            }
        }
    }
    return opportunities.slice(0, 10);
}

function buildEvidence(brief: ResearchBrief, video: VideoCandidate, matchedTopicTerms: string[], coveredAreas: string[]): EvidenceItem[] {
    const evidence: EvidenceItem[] = [
        { criterion: 'Transcript availability', passed: Boolean(video.transcript?.trim()), detail: video.transcript?.trim() ? 'Transcript is available for grounded analysis and citation.' : 'No transcript is available, so the video cannot support transcript-grounded collateral.' },
        { criterion: 'Topic relevance', passed: matchedTopicTerms.length > 0, detail: matchedTopicTerms.length > 0 ? `Matched topic terms: ${matchedTopicTerms.join(', ')}.` : 'No topic terms matched the available title, tags, or transcript.' },
        { criterion: 'Required coverage', passed: coveredAreas.length > 0, detail: coveredAreas.length > 0 ? `Contributes to: ${coveredAreas.join(', ')}.` : 'Does not contribute to a requested coverage area.' },
        { criterion: 'Identifiable source', passed: Boolean(video.channel.trim() && video.url.trim()), detail: video.channel.trim() && video.url.trim() ? `Published by ${video.channel} and linked to its source video.` : 'The video is missing a channel name or source URL.' },
        { criterion: 'Practical duration', passed: video.durationSeconds >= 180 && video.durationSeconds <= 14_400, detail: `Runtime: ${formatDuration(video.durationSeconds)}.` },
    ];
    if (brief.recencyTargetYears !== undefined) {
        const ageInYears = ageYears(video.publishedAt, brief.asOf);
        evidence.push({ criterion: 'Recency target', passed: ageInYears <= brief.recencyTargetYears, detail: `${ageInYears.toFixed(1)} years old; target is ${brief.recencyTargetYears} years or newer.` });
    }
    return evidence;
}

function validateBrief(brief: ResearchBrief): void {
    if (!brief.topic.trim()) throw new Error('A research topic is required.');
    if (!brief.audience.trim()) throw new Error('A target audience is required.');
    if (!Number.isInteger(brief.maxSelections) || brief.maxSelections < 1) throw new Error('maxSelections must be a positive integer.');
    if (Number.isNaN(Date.parse(brief.asOf))) throw new Error('asOf must be an ISO 8601 date.');
}
function terms(text: string): string[] { return [...new Set(normalize(text).split(' ').filter((term) => term.length > 2))]; }
function normalize(text: string): string { return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function ageYears(publishedAt: string, asOf: string): number { return Math.max(0, (Date.parse(asOf) - Date.parse(publishedAt)) / (365.25 * 24 * 60 * 60 * 1000)); }
function formatDuration(seconds: number): string { const minutes = Math.floor(seconds / 60); const remainingSeconds = Math.floor(seconds % 60); return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`; }
