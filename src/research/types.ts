export interface VideoCandidate {
    id: string;
    url: string;
    title: string;
    channel: string;
    publishedAt: string;
    durationSeconds: number;
    transcript?: string;
    tags?: string[];
    viewCount?: number;
    likeCount?: number;
    searchQuery?: string;
}

export interface ResearchBrief {
    topic: string;
    audience: string;
    requiredCoverage: string[];
    maxSelections: number;
    asOf: string;
    recencyTargetYears?: number;
}

export interface EvidenceItem {
    criterion: string;
    passed: boolean;
    detail: string;
}

export interface EvaluatedVideo {
    video: VideoCandidate;
    relevanceScore: number;
    qualityScore: number;
    selectionScore: number;
    matchedTopicTerms: string[];
    coveredAreas: string[];
    evidence: EvidenceItem[];
}

export interface ResearchCollection {
    brief: ResearchBrief;
    selected: EvaluatedVideo[];
    excluded: EvaluatedVideo[];
    generatedAt: string;
    selectionMethod: string;
    searchProvenance?: string[];
    viewingSequence?: string[];
    complementarySources?: Array<{ videoId: string; reason: string }>;
    disagreements?: Array<{ topic: string; videoIds: string[]; description: string }>;
}
