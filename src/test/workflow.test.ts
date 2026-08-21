import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { YoutubeTranscript } from 'youtube-transcript';

import {
    buildHostGenerationPrompt,
    generateWithDirectProvider,
    renderResourcePage,
    selectResearchCollection,
    type CollateralBrief,
    type DirectCollateralProvider,
    type ResearchBrief,
    type VideoCandidate,
    parseEnvironmentFile,
} from '../index.js';
import { SERVER_VERSION } from '../version.js';
import { normalizeTranscriptTimings, YouTubeCore } from '../youtube/youtube-core.js';

const brief: ResearchBrief = {
    topic: 'Power BI dashboard design',
    audience: 'business analysts',
    requiredCoverage: ['dashboard design', 'business question'],
    maxSelections: 2,
    asOf: '2026-08-20T00:00:00.000Z',
    recencyTargetYears: 5,
};

const videos: VideoCandidate[] = [
    {
        id: 'good-video-1',
        url: 'https://www.youtube.com/watch?v=good-video-1',
        title: 'Power BI dashboard design from the business question',
        channel: 'Decision Analytics',
        publishedAt: '2025-07-01T00:00:00.000Z',
        durationSeconds: 1_200,
        transcript: 'Start with the business question before selecting a dashboard chart.',
        tags: ['Power BI', 'dashboard design'],
    },
    {
        id: 'good-video-2',
        url: 'https://www.youtube.com/watch?v=good-video-2',
        title: 'Create a Power BI dashboard',
        channel: 'Practical BI',
        publishedAt: '2024-09-01T00:00:00.000Z',
        durationSeconds: 900,
        transcript: 'A dashboard should clarify the business question with an appropriate chart.',
        tags: ['Power BI', 'business question'],
    },
    {
        id: 'no-transcript',
        url: 'https://www.youtube.com/watch?v=no-transcript',
        title: 'Power BI dashboard design',
        channel: 'Uncaptioned BI',
        publishedAt: '2025-01-01T00:00:00.000Z',
        durationSeconds: 900,
    },
];

const collection = selectResearchCollection(brief, videos);

const collateralBrief: CollateralBrief = {
    kind: 'study-guide',
    title: 'Building decision-ready Power BI dashboards',
    audience: 'business analysts',
    learningObjectives: ['Frame a dashboard around a business question.'],
    claims: [{
        claim: 'A dashboard should begin with the decision and business question it must support.',
        citations: [{
            videoId: 'good-video-1',
            timestampSeconds: 5,
            rationale: 'Introduces the decision-first design principle.',
        }],
    }],
};

test('selects transcript-backed candidates and explains exclusions', () => {
    assert.equal(collection.selected.length, 2);
    assert.equal(collection.excluded.length, 1);
    assert.equal(collection.excluded[0]?.video.id, 'no-transcript');
    assert.match(collection.selected[0]?.evidence[0]?.detail ?? '', /Transcript is available/);
    assert.match(collection.selectionMethod, /inspectable totals/);
});

test('builds a citation-constrained host prompt', () => {
    const prompt = buildHostGenerationPrompt(collection, collateralBrief);

    assert.match(prompt.instructions, /Do not invent facts/);
    assert.match(prompt.instructions, /Paraphrase rather than quote/);
    assert.match(prompt.instructions, /Power BI dashboard design from the business question at 0:05/);
});

test('passes the same grounded contract to a configured direct provider', async () => {
    let receivedTitle = '';
    const provider: DirectCollateralProvider = {
        async generate(request) {
            receivedTitle = request.brief.title;
            return {
                title: request.brief.title,
                standfirst: 'A grounded guide.',
                sections: [{ heading: 'Start with the decision', paragraphs: ['Use the business question to guide the page.'] }],
                sourceNote: 'Based on selected captioned videos.',
            };
        },
    };

    const result = await generateWithDirectProvider(provider, collection, collateralBrief);

    assert.equal(receivedTitle, collateralBrief.title);
    assert.equal(result.sections.length, 1);
});

test('renders an accessible standalone resource page without injecting content', () => {
    const html = renderResourcePage(collection, {
        title: '<Unsafe title>',
        standfirst: 'A guide for business analysts.',
        sections: [{ heading: 'Decision first', paragraphs: ['Start with a question.'] }],
        studyQuestions: ['Which decision does your dashboard support?'],
        sourceNote: 'Sources are linked above.',
    });

    assert.match(html, /<meta charset="UTF-8">/);
    assert.match(html, /var\(--cp-bg\)/);
    assert.match(html, /&lt;Unsafe title&gt;/);
    assert.doesNotMatch(html, /<h1><Unsafe title><\/h1>/);
});

test('parses local environment values without accepting malformed entries', () => {
    assert.deepEqual(parseEnvironmentFile('# comment\nYOUTUBE_API_KEY="test-key"\nexport MODE=research\n'), [
        ['YOUTUBE_API_KEY', 'test-key'],
        ['MODE', 'research'],
    ]);
    assert.throws(() => parseEnvironmentFile('not a setting'), /Invalid .env entry/);
});

test('keeps package, registry, and MCP handshake versions aligned', () => {
    const packageManifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
    const registryManifest = JSON.parse(readFileSync(new URL('../../server.json', import.meta.url), 'utf8')) as {
        version: string;
        packages: Array<{ version: string }>;
    };

    assert.equal(SERVER_VERSION, packageManifest.version);
    assert.equal(registryManifest.version, packageManifest.version);
    assert.equal(registryManifest.packages[0]?.version, packageManifest.version);
});

test('normalizes classic and srv3 caption timings into seconds', () => {
    assert.deepEqual(normalizeTranscriptTimings([{ offset: 125.5, duration: 4.25 }], 'seconds'), [
        { offset: 125.5, duration: 4.25 },
    ]);
    assert.deepEqual(normalizeTranscriptTimings([{ offset: 125_500, duration: 4_250 }], 'milliseconds'), [
        { offset: 125.5, duration: 4.25 },
    ]);
});

test('stops catastrophic regex transcript searches without blocking the server', async () => {
    const originalFetchTranscript = YoutubeTranscript.fetchTranscript;
    YoutubeTranscript.fetchTranscript = async () => [{
        text: `${'a'.repeat(10_000)}!`,
        offset: 0,
        duration: 1_000,
        lang: 'en',
    }];

    try {
        const core = new YouTubeCore('');
        const validMatches = await core.searchTranscript('dQw4w9WgXcQ', '^a+!$', { regex: true });
        assert.equal(validMatches.length, 1);
        await assert.rejects(
            core.searchTranscript('dQw4w9WgXcQ', '(a+)+$', { regex: true }),
            /exceeded 250ms and was stopped/,
        );
    } finally {
        YoutubeTranscript.fetchTranscript = originalFetchTranscript;
    }
});
