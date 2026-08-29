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

/** Find high-value, timestamped transcript sections without requiring the Data API. */
export function findRelevantSegments(brief: SegmentResearchBrief, transcript: VideoTranscript): ResearchSegment[] {
    const requestedTopics = uniqueTerms([brief.objective, ...brief.topics]);
    const minDuration = brief.minDurationSeconds ?? 30;
    const maxDuration = brief.maxDurationSeconds ?? 600;
    const windows = buildWindows(transcript, minDuration, maxDuration);
    const ranked = windows
        .map((window) => scoreWindow(brief.videoId, requestedTopics, window))
        .filter((segment) => segment.matchedTopics.length > 0)
        .sort((left, right) => right.confidence - left.confidence || left.startSeconds - right.startSeconds);

    const selected: ResearchSegment[] = [];
    const limit = brief.maxSegments ?? 8;
    for (const candidate of ranked) {
        if (selected.length >= limit) break;
        // Prefer distinct learning moments over overlapping copies of the same moment.
        if (selected.some((item) => overlapRatio(item, candidate) >= 0.5)) continue;
        selected.push(candidate);
    }
    return selected.sort((left, right) => left.startSeconds - right.startSeconds);
}

interface TranscriptEntry { text: string; offset: number; duration: number; }
interface TranscriptWindow { entries: TranscriptEntry[]; startSeconds: number; endSeconds: number; }

function buildWindows(transcript: VideoTranscript, minDuration: number, maxDuration: number): TranscriptWindow[] {
    const entries = transcript.segments
        .map((segment) => ({ text: segment.text.trim(), offset: segment.offset, duration: segment.duration }))
        .filter((segment) => segment.text && Number.isFinite(segment.offset) && Number.isFinite(segment.duration) && segment.duration >= 0);
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
            if (duration > maxDuration) break;
        }
    }
    return windows;
}

function scoreWindow(videoId: string, requestedTopics: string[], window: TranscriptWindow): ResearchSegment {
    const text = window.entries.map((entry) => entry.text).join(' ');
    const normalized = normalize(text);
    const matchedTopics = requestedTopics.filter((topic) => normalized.includes(topic));
    const matchedTokenCount = matchedTopics.reduce((count, topic) => count + topic.split(' ').length, 0);
    const totalTokenCount = Math.max(1, requestedTopics.reduce((count, topic) => count + topic.split(' ').length, 0));
    const coverage = matchedTopics.length / Math.max(1, requestedTopics.length);
    const lexical = Math.min(1, matchedTokenCount / Math.max(1, totalTokenCount));
    const phraseBonus = matchedTopics.filter((topic) => topic.includes(' ') && normalized.includes(topic)).length / Math.max(1, matchedTopics.length);
    const confidence = Math.min(1, coverage * 0.55 + lexical * 0.25 + phraseBonus * 0.2);

    return {
        videoId,
        startSeconds: Math.floor(window.startSeconds),
        endSeconds: Math.ceil(window.endSeconds),
        title: matchedTopics.slice(0, 3).join(', ') || 'Relevant section',
        summary: text.slice(0, 500).trim(),
        matchedTopics,
        rationale: `Transcript window covers ${matchedTopics.length} of ${requestedTopics.length} requested topic terms, with phrase matches weighted more strongly.`,
        evidence: window.entries.map((entry) => `[${formatTime(entry.offset)}] ${entry.text}`),
        confidence: Number(confidence.toFixed(3)),
        url: `https://youtu.be/${videoId}?t=${Math.floor(window.startSeconds)}`,
    };
}

function overlapRatio(left: ResearchSegment, right: ResearchSegment): number {
    const overlap = Math.max(0, Math.min(left.endSeconds, right.endSeconds) - Math.max(left.startSeconds, right.startSeconds));
    const shorter = Math.max(1, Math.min(left.endSeconds - left.startSeconds, right.endSeconds - right.startSeconds));
    return overlap / shorter;
}

function uniqueTerms(values: string[]): string[] {
    return [...new Set(values.flatMap((value) => normalize(value).split(' ').filter((term) => term.length > 2)))];
}
function normalize(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function formatTime(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remaining = total % 60;
    return hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}` : `${minutes}:${remaining.toString().padStart(2, '0')}`;
}
