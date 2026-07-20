"use strict";
/**
 * Authenticity Score Calculator
 *
 * Calculates the overall authenticity score for a profile
 * based on weighted category scores.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticityCalculator = void 0;
class AuthenticityCalculator {
    weights = {
        verification: 0.30,
        botDetection: 0.25,
        deepfake: 0.20,
        impersonation: 0.15,
        activity: 0.10,
    };
    /**
     * Calculate total authenticity score (0-100)
     */
    calculateScore(categories) {
        let totalScore = 0;
        // Verification score (0-30 points, 30% weight)
        totalScore += categories.verification.score;
        // Bot detection score (0-25 points, 25% weight)
        totalScore += categories.botDetection.score;
        // Deepfake score (0-20 points, 20% weight)
        totalScore += categories.deepfake.score;
        // Impersonation score (0-15 points, 15% weight)
        totalScore += categories.impersonation.score;
        // Activity score (0-10 points, 10% weight)
        totalScore += categories.activity.score;
        return Math.min(Math.max(totalScore, 0), 100);
    }
    /**
     * Get category weights
     */
    getWeights() {
        return { ...this.weights };
    }
    /**
     * Calculate score breakdown for display
     */
    calculateBreakdown(categories) {
        const verificationPercent = (categories.verification.score / categories.verification.maxScore) * 100;
        const botDetectionPercent = (categories.botDetection.score / categories.botDetection.maxScore) * 100;
        const deepfakePercent = (categories.deepfake.score / categories.deepfake.maxScore) * 100;
        const impersonationPercent = (categories.impersonation.score / categories.impersonation.maxScore) * 100;
        const activityPercent = (categories.activity.score / categories.activity.maxScore) * 100;
        return {
            total: this.calculateScore(categories),
            categories: {
                verification: {
                    score: categories.verification.score,
                    maxScore: categories.verification.maxScore,
                    percent: verificationPercent,
                    weight: this.weights.verification,
                    status: categories.verification.status,
                },
                botDetection: {
                    score: categories.botDetection.score,
                    maxScore: categories.botDetection.maxScore,
                    percent: botDetectionPercent,
                    weight: this.weights.botDetection,
                    status: categories.botDetection.status,
                },
                deepfake: {
                    score: categories.deepfake.score,
                    maxScore: categories.deepfake.maxScore,
                    percent: deepfakePercent,
                    weight: this.weights.deepfake,
                    status: categories.deepfake.status,
                },
                impersonation: {
                    score: categories.impersonation.score,
                    maxScore: categories.impersonation.maxScore,
                    percent: impersonationPercent,
                    weight: this.weights.impersonation,
                    status: categories.impersonation.status,
                },
                activity: {
                    score: categories.activity.score,
                    maxScore: categories.activity.maxScore,
                    percent: activityPercent,
                    weight: this.weights.activity,
                    status: categories.activity.status,
                },
            },
        };
    }
    /**
     * Determine which categories are dragging down the score
     */
    identifyWeaknesses(categories) {
        const weaknesses = [];
        for (const [name, category] of Object.entries(categories)) {
            const percent = category.score / category.maxScore;
            if (percent < 0.5) {
                weaknesses.push({
                    category: name,
                    severity: percent < 0.25 ? 'high' : 'medium',
                    score: category.score,
                    maxScore: category.maxScore,
                    percent: percent * 100,
                });
            }
        }
        return weaknesses.sort((a, b) => a.percent - b.percent);
    }
    /**
     * Generate improvement suggestions
     */
    generateSuggestions(categories) {
        const suggestions = [];
        const weaknesses = this.identifyWeaknesses(categories);
        for (const weakness of weaknesses) {
            switch (weakness.category) {
                case 'verification':
                    suggestions.push('Get verified on the platform to increase authenticity');
                    break;
                case 'botDetection':
                    suggestions.push('Remove suspicious followers and improve engagement quality');
                    break;
                case 'deepfake':
                    suggestions.push('Use an authentic profile photo instead of AI-generated images');
                    break;
                case 'impersonation':
                    suggestions.push('Change username to avoid impersonation patterns');
                    break;
                case 'activity':
                    suggestions.push('Maintain consistent posting activity over time');
                    break;
            }
        }
        return suggestions;
    }
}
exports.AuthenticityCalculator = AuthenticityCalculator;
exports.default = AuthenticityCalculator;
//# sourceMappingURL=scoring.js.map