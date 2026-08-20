import type { ResearchCollection } from '../research/types.js';

export type CollateralKind = 'article' | 'study-guide' | 'summary';

export interface TimestampCitation {
    videoId: string;
    timestampSeconds: number;
    rationale: string;
}

export interface GroundedClaim {
    claim: string;
    citations: TimestampCitation[];
}

export interface CollateralBrief {
    kind: CollateralKind;
    title: string;
    audience: string;
    learningObjectives: string[];
    claims: GroundedClaim[];
}

export interface CollateralSection {
    heading: string;
    paragraphs: string[];
}

export interface CollateralDocument {
    title: string;
    standfirst: string;
    sections: CollateralSection[];
    studyQuestions?: string[];
    sourceNote: string;
}

export interface HostGenerationPrompt {
    name: string;
    description: string;
    instructions: string;
}

export interface DirectGenerationRequest {
    collection: ResearchCollection;
    brief: CollateralBrief;
    prompt: HostGenerationPrompt;
}

export interface DirectCollateralProvider {
    generate(request: DirectGenerationRequest): Promise<CollateralDocument>;
}
