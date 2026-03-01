/**
 * Hybrid Detection Model - Gen-Z Slang Detection Results
 */
const mongoose = require('mongoose');

const slangDetectionSchema = new mongoose.Schema({
    sentence: { type: String, required: true },
    detected_slang: [String],
    detection_method: { type: String, enum: ['Rule-Based', 'AI Model', 'Hybrid'], default: 'Hybrid' },
    confidence: { type: Number, default: 0 },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    is_ambiguous: { type: Boolean, default: false }
}, { _id: false });

const hybridDetectionSchema = new mongoose.Schema({
    meeting_id: { type: String, required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // OPTIONAL: Not all participants may be registered users
    user_name: { type: String, required: true },
    
    // Professional Score (WMFSA Algorithm)
    professional_score: { type: Number, default: 100, min: 0, max: 100 },
    score_label: { type: String, enum: ['Excellent', 'Good', 'Fair', 'Poor'], default: 'Excellent' },
    
    // Score Components
    frequency_penalty: { type: Number, default: 0 },      // D1 (35%)
    severity_penalty: { type: Number, default: 0 },       // D2 (25%)
    repetition_penalty: { type: Number, default: 0 },     // D3 (15%)
    confidence_penalty: { type: Number, default: 0 },     // D4 (15%)
    engagement_bonus: { type: Number, default: 0 },       // B1 (10%)
    
    // Detection Results
    total_sentences: { type: Number, default: 0 },
    slang_detections: [slangDetectionSchema],
    total_slang_count: { type: Number, default: 0 },
    unique_slang_terms: [String],
    
    // Transcript
    transcript: { type: String, default: '' },
    
    // Metadata
    processed_at: { type: Date, default: Date.now }
});

// Compound index for quick lookups
// Changed to use user_name instead of user_id to support participants without registered accounts
hybridDetectionSchema.index({ meeting_id: 1, user_name: 1 }, { unique: true });
hybridDetectionSchema.index({ user_id: 1 }); // Keep for searching by user_id when available
hybridDetectionSchema.index({ professional_score: -1 });

// Transform to JSON
hybridDetectionSchema.methods.toJSON = function() {
    const detection = this.toObject();
    delete detection.__v;
    detection.id = detection._id.toString();
    return detection;
};

module.exports = mongoose.model('HybridDetection', hybridDetectionSchema);
