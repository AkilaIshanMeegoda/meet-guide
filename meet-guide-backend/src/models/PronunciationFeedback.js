/**
 * Pronunciation Feedback Model
 */
const mongoose = require('mongoose');

const mispronunciationErrorSchema = new mongoose.Schema({
    word: String,
    spoken: String,
    expected: String,
    expected_phonemes: String,
    actual_phonemes: String,
    error_type: { type: String, default: 'unknown' },
    severity: { type: String, default: 'medium' },
    confidence: { type: Number, default: 0 },
    start_time: { type: Number, default: 0 },
    end_time: { type: Number, default: 0 },
    context: String,
    suggestion: String
}, { _id: false });

const pronunciationFeedbackSchema = new mongoose.Schema({
    meeting_id: { type: String, required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user_name: { type: String, required: true },
    total_words: { type: Number, default: 0 },
    mispronounced_count: { type: Number, default: 0 },
    accuracy: { type: Number, default: 100 },
    error_rate: { type: Number, default: 0 },
    mispronunciations: [mispronunciationErrorSchema],  // Renamed from 'errors' to avoid Mongoose warning
    transcript: { type: String, default: '' },
    processed_at: { type: Date, default: Date.now }
}, { suppressReservedKeysWarning: true });

// Virtual getter for backward compatibility
pronunciationFeedbackSchema.virtual('errors').get(function() {
    return this.mispronunciations;
});

pronunciationFeedbackSchema.virtual('errors').set(function(val) {
    this.mispronunciations = val;
});

// Compound index
pronunciationFeedbackSchema.index({ meeting_id: 1, user_id: 1 }, { unique: true });
pronunciationFeedbackSchema.index({ user_id: 1 });

// Transform to JSON
pronunciationFeedbackSchema.methods.toJSON = function() {
    const feedback = this.toObject({ virtuals: true });
    delete feedback.__v;
    feedback.id = feedback._id.toString();
    feedback.errors = feedback.mispronunciations || [];
    return feedback;
};

module.exports = mongoose.model('PronunciationFeedback', pronunciationFeedbackSchema);
