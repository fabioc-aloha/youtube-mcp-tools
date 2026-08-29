import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateCandidate, selectResearchCollection } from '../research/select.js';
import { findRelevantSegments } from '../research/segments.js';
import type { ResearchBrief, VideoCandidate } from '../research/types.js';

const lasagnaBrief: ResearchBrief = {
    topic: 'exceptional restaurant-quality lasagna',
    audience: 'experienced home cook',
    requiredCoverage: [
        'ragù meat sauce',
        'pasta technique',
        'béchamel cheese balance',
        'layering assembly',
        'baking resting',
        'expert techniques common mistakes',
    ],
    maxSelections: 6,
    asOf: '2026-08-29T00:00:00.000Z',
};

function video(id: string, title: string, transcript: string, channel = id): VideoCandidate {
    return {
        id,
        url: `https://youtu.be/${id}`,
        title,
        channel,
        publishedAt: '2025-06-01T00:00:00.000Z',
        durationSeconds: 900,
        transcript,
        tags: ['lasagna'],
    };
}

test('expert selection ignores generic cooking language', () => {
    const weak = video('weak', 'How to make the best easy homemade food', 'Today I will show you how to cook a great easy homemade dish.');
    const evaluated = evaluateCandidate(lasagnaBrief, weak);
    assert.deepEqual(evaluated.matchedTopicTerms, []);
    assert.deepEqual(evaluated.coveredAreas, []);
    assert.equal(evaluated.evidence.find((item) => item.criterion === 'Topic relevance')?.passed, false);
});

test('expert selection requires meaningful coverage evidence', () => {
    const incidental = video('incidental', 'The best lasagna recipe', 'This is an easy recipe. The dish is great and simple to cook.');
    const evaluated = evaluateCandidate(lasagnaBrief, incidental);
    assert.deepEqual(evaluated.coveredAreas, []);
    assert.equal(evaluated.evidence.find((item) => item.criterion === 'Required coverage')?.passed, false);
});

test('expert selection builds a multi-source collection around distinct coverage', () => {
    const candidates = [
        video('ragu', 'Lasagna ragù technique', 'Brown the meat deeply, develop fond, then build a slow ragù meat sauce. Avoid rushing the reduction.', 'Sauce Lab'),
        video('pasta', 'Fresh pasta for lasagna', 'Roll fresh pasta thinly and blanch it briefly before assembly so the sheets stay tender.', 'Pasta School'),
        video('bechamel', 'Béchamel and cheese balance for lasagna', 'Make a smooth béchamel and balance it with cheese so the finished lasagna is creamy without becoming heavy.', 'Italian Kitchen'),
        video('assembly', 'Lasagna layering and assembly', 'Layer sauce, pasta, béchamel and cheese evenly. Keep the layers consistent and avoid overfilling the corners.', 'Home Cook Pro'),
        video('bake', 'Lasagna baking and resting', 'Bake until bubbling and browned, then rest for at least thirty minutes so the layers set before slicing.', 'Oven Notes'),
        video('junk', 'Easy best lasagna in 30 seconds', 'Make this easy great lasagna recipe. Cook it and enjoy this food.', 'Shorts Channel'),
    ];
    candidates[5].durationSeconds = 30;

    const collection = selectResearchCollection(lasagnaBrief, candidates);
    assert.equal(collection.selected.length, 5);
    assert.ok(collection.selected.some((item) => item.video.id === 'ragu'));
    assert.ok(collection.selected.some((item) => item.video.id === 'pasta'));
    assert.ok(collection.selected.some((item) => item.video.id === 'bechamel'));
    assert.ok(collection.selected.some((item) => item.video.id === 'assembly'));
    assert.ok(collection.selected.some((item) => item.video.id === 'bake'));
    assert.ok(collection.excluded.some((item) => item.video.id === 'junk'));
    assert.ok(collection.complementarySources?.length);
});

test('comparison opportunities require genuinely shared coverage', () => {
    const left = video('left', 'Lasagna béchamel technique', 'Make a smooth béchamel and balance it with cheese.', 'Kitchen A');
    const right = video('right', 'Lasagna layering with béchamel', 'Layer pasta, béchamel and cheese evenly for consistent assembly.', 'Kitchen B');
    const collection = selectResearchCollection({ ...lasagnaBrief, maxSelections: 2 }, [left, right]);
    assert.ok(collection.comparisonOpportunities?.some((item) => item.videoIds.includes('left') && item.videoIds.includes('right')));
});

test('research discovery expands every requested coverage area', () => {
    const queries = [lasagnaBrief.topic, ...lasagnaBrief.requiredCoverage.map((area) => `${lasagnaBrief.topic} ${area}`)];
    assert.equal(new Set(queries).size, lasagnaBrief.requiredCoverage.length + 1);
});

test('segment intelligence rejects generic-only transcript matches', () => {
    const segments = findRelevantSegments({
        videoId: 'junk',
        objective: 'exceptional restaurant-quality lasagna',
        topics: ['ragù meat sauce', 'béchamel cheese balance'],
        maxSegments: 5,
        minDurationSeconds: 5,
        maxDurationSeconds: 60,
    }, {
        videoId: 'junk',
        fullText: 'This is the best easy homemade recipe. Cook this great food and enjoy.',
        segments: [{ text: 'This is the best easy homemade recipe. Cook this great food and enjoy.', offset: 0, duration: 12 }],
    });
    assert.equal(segments.length, 0);
});

test('segment intelligence prefers explicit technique phrases', () => {
    const segments = findRelevantSegments({
        videoId: 'expert',
        objective: 'make exceptional lasagna',
        topics: ['develop ragù meat sauce', 'béchamel cheese balance'],
        maxSegments: 3,
        minDurationSeconds: 5,
        maxDurationSeconds: 60,
    }, {
        videoId: 'expert',
        fullText: 'First brown the meat deeply and develop the fond. Then make a slow ragù meat sauce. Finally make a smooth béchamel and balance it with cheese.',
        segments: [
            { text: 'First brown the meat deeply and develop the fond.', offset: 10, duration: 8 },
            { text: 'Then make a slow ragù meat sauce.', offset: 18, duration: 8 },
            { text: 'Finally make a smooth béchamel and balance it with cheese.', offset: 26, duration: 10 },
        ],
    });
    assert.ok(segments.length > 0);
    assert.ok(segments.some((segment) => segment.matchedTopics.some((topic) => topic.includes('ragù meat sauce'))));
    assert.ok(segments.some((segment) => segment.matchedTopics.some((topic) => topic.includes('béchamel cheese balance'))));
});
