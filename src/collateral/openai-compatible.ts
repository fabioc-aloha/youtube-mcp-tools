import type {
    CollateralDocument,
    DirectCollateralProvider,
    DirectGenerationRequest,
} from './types.js';

export interface OpenAiCompatibleOptions {
    apiKey: string;
    model: string;
    baseUrl?: string;
}

/**
 * Optional direct-generation adapter. It is created only from explicit
 * configuration, so MCP hosts remain the default writing surface.
 */
export class OpenAiCompatibleProvider implements DirectCollateralProvider {
    private readonly endpoint: string;

    constructor(private readonly options: OpenAiCompatibleOptions) {
        this.endpoint = `${(options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`;
    }

    async generate(request: DirectGenerationRequest): Promise<CollateralDocument> {
        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.options.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.options.model,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: 'You produce original, source-grounded educational collateral. Return valid JSON only.',
                    },
                    {
                        role: 'user',
                        content: `${request.prompt.instructions}\n\nReturn JSON with title, standfirst, sections (heading and paragraphs), optional studyQuestions, and sourceNote.`,
                    },
                ],
            }),
        });
        if (!response.ok) {
            throw new Error(`Direct provider request failed: ${response.status} ${await response.text()}`);
        }
        const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = body.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('Direct provider returned no message content.');
        }
        return parseCollateralDocument(content);
    }
}

export function createDirectProviderFromEnvironment(): DirectCollateralProvider | undefined {
    const provider = process.env.YOUTUBE_MCP_DIRECT_PROVIDER;
    if (!provider) {
        return undefined;
    }
    if (provider !== 'openai-compatible') {
        throw new Error(`Unsupported direct provider: ${provider}. Supported value: openai-compatible.`);
    }
    const apiKey = process.env.YOUTUBE_MCP_DIRECT_API_KEY;
    if (!apiKey) {
        throw new Error('YOUTUBE_MCP_DIRECT_API_KEY is required for direct generation.');
    }
    return new OpenAiCompatibleProvider({
        apiKey,
        model: process.env.YOUTUBE_MCP_DIRECT_MODEL ?? 'gpt-4.1-mini',
        baseUrl: process.env.YOUTUBE_MCP_DIRECT_BASE_URL,
    });
}

function parseCollateralDocument(content: string): CollateralDocument {
    const parsed = JSON.parse(content) as Partial<CollateralDocument>;
    if (
        typeof parsed.title !== 'string'
        || typeof parsed.standfirst !== 'string'
        || !Array.isArray(parsed.sections)
        || typeof parsed.sourceNote !== 'string'
    ) {
        throw new Error('Direct provider response did not match the collateral document contract.');
    }
    return {
        title: parsed.title,
        standfirst: parsed.standfirst,
        sections: parsed.sections.map((section) => {
            if (typeof section?.heading !== 'string' || !Array.isArray(section.paragraphs)) {
                throw new Error('Direct provider returned an invalid collateral section.');
            }
            return {
                heading: section.heading,
                paragraphs: section.paragraphs.map((paragraph) => {
                    if (typeof paragraph !== 'string') {
                        throw new Error('Direct provider returned a non-text paragraph.');
                    }
                    return paragraph;
                }),
            };
        }),
        studyQuestions: parsed.studyQuestions?.filter((question): question is string => typeof question === 'string'),
        sourceNote: parsed.sourceNote,
    };
}
