import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { findRelevantSegments, type SegmentResearchBrief } from '../research/segments.js';
import type { VideoTranscript } from '../youtube/youtube-core.js';
import type { YouTubeCore } from '../youtube/youtube-core.js';

export function registerSegmentTools(server: McpServer, core: YouTubeCore): void {
    server.registerTool(
        'youtube_find_relevant_segments',
        {
            title: 'Find Relevant Video Segments',
            description: 'Find timestamped transcript sections relevant to a research objective. Does not require a YouTube API key.',
            inputSchema: {
                video: z.string().min(1),
                objective: z.string().min(1).max(1000),
                topics: z.array(z.string().min(1).max(256)).default([]),
                maxSegments: z.number().int().min(1).max(20).default(8),
                minDurationSeconds: z.number().int().min(5).max(600).default(30),
                maxDurationSeconds: z.number().int().min(30).max(900).default(600),
            },
        },
        async ({ video, objective, topics, maxSegments, minDurationSeconds, maxDurationSeconds }) => {
            const videoId = core.constructor['extractVideoId'](video);
            const transcript = await core.getTranscript(videoId) as VideoTranscript;
            const brief: SegmentResearchBrief = {
                videoId,
                objective,
                topics,
                maxSegments,
                minDurationSeconds,
                maxDurationSeconds,
            };
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(findRelevantSegments(brief, transcript), null, 2),
                }],
            };
        },
    );
}
