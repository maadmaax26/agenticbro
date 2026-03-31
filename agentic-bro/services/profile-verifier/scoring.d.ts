/**
 * Authenticity Score Calculator
 *
 * Calculates the overall authenticity score for a profile
 * based on weighted category scores.
 */
export declare class AuthenticityCalculator {
    private weights;
    /**
     * Calculate total authenticity score (0-100)
     */
    calculateScore(categories: CategoryScores): number;
    /**
     * Get category weights
     */
    getWeights(): Record<string, number>;
    /**
     * Calculate score breakdown for display
     */
    calculateBreakdown(categories: CategoryScores): ScoreBreakdown;
    /**
     * Determine which categories are dragging down the score
     */
    identifyWeaknesses(categories: CategoryScores): CategoryWeakness[];
    /**
     * Generate improvement suggestions
     */
    generateSuggestions(categories: CategoryScores): string[];
}
interface CategoryScores {
    verification: {
        score: number;
        maxScore: number;
        status: string;
    };
    botDetection: {
        score: number;
        maxScore: number;
        status: string;
    };
    deepfake: {
        score: number;
        maxScore: number;
        status: string;
    };
    impersonation: {
        score: number;
        maxScore: number;
        status: string;
    };
    activity: {
        score: number;
        maxScore: number;
        status: string;
    };
}
interface ScoreBreakdown {
    total: number;
    categories: {
        [key: string]: {
            score: number;
            maxScore: number;
            percent: number;
            weight: number;
            status: string;
        };
    };
}
interface CategoryWeakness {
    category: string;
    severity: 'low' | 'medium' | 'high';
    score: number;
    maxScore: number;
    percent: number;
}
export default AuthenticityCalculator;
//# sourceMappingURL=scoring.d.ts.map