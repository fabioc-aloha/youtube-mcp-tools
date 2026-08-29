import type { VideoTranscript } from '../index.js';

export interface ResearchSegment {
    videoId: string;
    startSeconds: number;
    endSeconds: number;
    title: string;
    summary: string;
    matchedTopics: string[];
    rationale: string;
    evidence: string[];
    confidence: number;
    url: string;
}

export interface SegmentResearchBrief {
    videoId: string;
    objective: string;
    topics: string[];
    maxSegments?: number;
    minDurationSeconds?: number;
    maxDurationSeconds?: number;
}

/**
 * Find transcript windows that are directly useful to a research objective.
 *
 * This is intentionally deterministic and evidence-first. It is a reusable
 * primitive rather than a model-generated interpretation: callers can layer
 * richer semantic ranking on top without losing timestamp provenance.
 */
export function findRelevantSegments(
    brief: SegmentResearchBrief,
    transcript: VideoTranscript,
): ResearchSegment[] {
    const requestedTopics = uniqueTerms([brief.objective, ...brief.topics]);
    const minDuration = brief.minDurationSeconds ?? 30;
    const maxDuration = brief.maxDurationSeconds ?? 600;
    const windows = buildWindows(transcript, minDuration, maxDuration);

    return windows
        .map((window) => scoreWindow(brief.videoId, requestedTopics, window))
        .filter((segment) => segment.matchedTopics.length > 0)
        .sort((left, right) => right.confidence - left.confidence || left.startSeconds - right.startSeconds)
        .slice(0, brief.maxSegments ?? 8);
}

interface TranscriptEntry {
    text: string;
    offset: number;
    duration: number;
}

interface TranscriptWindow {
    entries: TranscriptEntry[];
    startSeconds: number;
    endSeconds: number;
}

function buildWindows(transcript: VideoTranscript, minDuration: number, maxDuration: number): TranscriptWindow[] {
    const entries = transcript.segments
        .map((segment) => ({
            text: segment.text.trim(),
            offset: segment.offset,
            duration: segment.duration,
        }))
        .filter((segment) => segment.text && Number.isFinite(segment.offset));

    const windows: TranscriptWindow[] = [];
    for (let start = 0; start < entries.length; start += 1) {
        const first = entries[start];
        const selected: TranscriptEntry[] = [];
        for (let index = start; index < entries.length; index += 1) {
            selected.push(entries[index]);
            const end = entries[index].offset + entries[index].duration;
            const duration = end - first.offset;
            if (duration >= minDuration) {
                windows.push({ entries: [...selected], startSeconds: first.offset, endSeconds: end });
                break;
            }
            if (duration > maxDuration) {
                break;
            }
        }
    }
    return windows;
}

function scoreWindow(videoId: string, requestedTopics: string[], window: TranscriptWindow): ResearchSegment {
    const text = window.entries.map((entry) => entry.text).join(' ');
    const normalized = normalize(text);
    const matchedTopics = requestedTopics.filter((topic) => normalized.includes(topic));
    const density = requestedTopics.length === 0 ? 0 : matchedTopics.length / requestedTopics.length;
    const confidence = Math.min(1, density * 0.8 + lexicalDensity(normalized, matchedTopics) * 0.2);

    return {
        videoId,
        startSeconds: Math.floor(window.startSeconds),
        endSeconds: Math.ceil(window.endSeconds),
        title: matchedTopics.length > 0 ? matchedTopics.slice(0, 3).join(', ') : 'Relevant section',
        summary: text.slice(0, 500).trim(),
        matchedTopics,
        rationale: `Transcript window matches ${matchedTopics.length} of ${requestedTopics.length} requested topic terms.`,
        evidence: window.entries.map((entry) => `[${formatTime(entry.offset)}] ${entry.text}`),
        confidence: Number(confidence.toFixed(3)),
        url: `https://youtu.be/${videoId}?t=${Math.floor(window.startSeconds)}`,
    };
}

function uniqueTerms(values: string[]): string[] {
    return [...new Set(values.flatMap((value) => normalize(value).split(' ').filter((term) => term.length > 2)))];
}

function normalize(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function lexicalDensity(text: string, terms: string[]): number {
    if (terms.length === 0 || !text) return 0;
    const tokens = text.split(' ').filter(Boolean);
    return Math.min(1, terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0) / Math.max(1, tokens.length / 10));
}

function formatTime(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remaining = total % 60;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
    return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}
