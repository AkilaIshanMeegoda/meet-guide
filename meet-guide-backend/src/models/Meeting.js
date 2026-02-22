/**
 * Meeting Model
 */
const mongoose = require('mongoose');

// Participant sub-schema
const participantSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    full_name: { type: String, default: '' },
    joined_at: { type: Date, default: Date.now }
}, { _id: false });

// Utterance sub-schema for structured transcript
const utteranceSchema = new mongoose.Schema({
    speaker: { type: String, required: true },
    text: { type: String, required: true },
    start: { type: Number, default: 0 },
    end: { type: Number, default: 0 }
}, { _id: false });

// Transcript sub-schema
const transcriptSchema = new mongoose.Schema({
    speaker_mapping: { type: Map, of: String, default: {} },
    utterances: [utteranceSchema],
    formatted_transcript: { type: String, default: '' },
    plain_text: { type: String, default: '' },
    uploaded_at: { type: Date, default: Date.now }
}, { _id: false });

const meetingSchema = new mongoose.Schema({
    meeting_id: {
        type: String,
        required: true,
        unique: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    host_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    host_name: {
        type: String,
        default: 'Unknown'
    },
    host_email: {
        type: String,
        default: ''
    },
    participants: [participantSchema],
    status: {
        type: String,
        enum: ['scheduled', 'active', 'ended', 'cancelled'],
        default: 'scheduled'
    },
    scheduled_start: {
        type: Date,
        default: null
    },
    scheduled_end: {
        type: Date,
        default: null
    },
    actual_start: {
        type: Date,
        default: null
    },
    actual_end: {
        type: Date,
        default: null
    },
    recording_folder: {
        type: String,
        default: null
    },
    transcript: {
        type: transcriptSchema,
        default: null
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: null
    }
});

// Indexes
meetingSchema.index({ meeting_id: 1 }, { unique: true });
meetingSchema.index({ host_id: 1 });
meetingSchema.index({ 'participants.email': 1 });
meetingSchema.index({ status: 1 });
meetingSchema.index({ created_at: -1 });

// Drop old indexes before creating new ones
meetingSchema.pre('save', async function() {
    if (this.isNew) {
        try {
            // Try to drop the old room_id index if it exists
            await this.collection.dropIndex('room_id_1').catch(() => {});
        } catch (err) {
            // Ignore if index doesn't exist
        }
    }
});

// Virtual for MiroTalk URL
meetingSchema.virtual('mirotalk_url').get(function() {
    const mirotalkUrl = process.env.MIROTALK_URL || 'https://localhost:3010';
    return `${mirotalkUrl}/join/${this.meeting_id}`;
});

// Transform to JSON
meetingSchema.methods.toJSON = function() {
    const meeting = this.toObject({ virtuals: true });
    delete meeting.__v;
    meeting.id = meeting._id.toString();
    return meeting;
};

module.exports = mongoose.model('Meeting', meetingSchema);
