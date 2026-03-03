/**
 * User Model
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    full_name: {
        type: String,
        trim: true
    },
    hashed_password: {
        type: String,
        required: true
    },
    is_active: {
        type: Boolean,
        default: true
    },
    is_management: {
        type: Boolean,
        default: false
    },
    profile_image: {
        type: String,
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

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('hashed_password')) return next();
    
    // Only hash if it's not already hashed
    if (!this.hashed_password.startsWith('$2')) {
        const salt = await bcrypt.genSalt(10);
        this.hashed_password = await bcrypt.hash(this.hashed_password, salt);
    }
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.hashed_password);
};

// Transform to JSON (hide password)
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.hashed_password;
    delete user.__v;
    user.id = user._id.toString();
    return user;
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

// Static method to find by username
userSchema.statics.findByUsername = function(username) {
    return this.findOne({ username: username.toLowerCase() });
};

module.exports = mongoose.model('User', userSchema);
