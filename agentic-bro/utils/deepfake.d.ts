/**
 * Deepfake Detection Utility
 *
 * Analyzes images for AI-generated content and manipulation
 */
export interface DeepfakeAnalysisResult {
    aiGeneratedProbability: number;
    manipulationProbability: number;
    faceMatch: boolean;
    faceConfidence: number;
    artifacts: ArtifactDetection[];
    metadata: ImageMetadata;
}
interface ArtifactDetection {
    type: string;
    confidence: number;
    location?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
interface ImageMetadata {
    width: number;
    height: number;
    format: string;
    hasTransparency: boolean;
    colorDepth: number;
}
export declare class DeepfakeDetector {
    private modelPath;
    constructor(modelPath: string);
    /**
     * Analyze an image for AI-generated content
     */
    analyze(imageBuffer: Buffer): Promise<DeepfakeAnalysisResult>;
    /**
     * Detect AI-generated content probability
     */
    private detectAIGeneration;
    /**
     * Check for GAN artifacts (grid patterns, checkerboard)
     */
    private checkGANArtifacts;
    /**
     * Check texture consistency across the image
     */
    private checkTextureConsistency;
    /**
     * Check noise patterns
     */
    private checkNoisePatterns;
    /**
     * Check color distribution
     */
    private checkColorDistribution;
    /**
     * Detect manipulation in image
     */
    private detectManipulation;
    /**
     * Detect face in image
     */
    private detectFace;
    /**
     * Detect artifacts in image
     */
    private detectArtifacts;
    /**
     * Compare two faces (for impersonation detection)
     */
    compareFaces(image1Buffer: Buffer, image2Buffer: Buffer): Promise<{
        match: boolean;
        confidence: number;
    }>;
    /**
     * Batch analyze multiple images
     */
    batchAnalyze(images: Buffer[]): Promise<DeepfakeAnalysisResult[]>;
}
export default DeepfakeDetector;
//# sourceMappingURL=deepfake.d.ts.map