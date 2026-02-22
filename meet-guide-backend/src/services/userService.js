/**
 * User Service
 */
const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * Create a new user
 */
async function createUser(userData) {
    const { email, username, password, full_name } = userData;

    // Check if email exists
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
        throw new Error('Email already registered');
    }

    // Check if username exists
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
        throw new Error('Username already taken');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashed_password = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        full_name,
        hashed_password
    });

    await user.save();
    return user;
}

/**
 * Authenticate user
 */
async function authenticateUser(email, password) {
    const user = await User.findByEmail(email);
    
    if (!user) {
        return null;
    }

    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
        return null;
    }

    if (!user.is_active) {
        return null;
    }

    return user;
}

/**
 * Get user by ID
 */
async function getUserById(userId) {
    return User.findById(userId);
}

/**
 * Get user by username
 */
async function getUserByUsername(username) {
    return User.findByUsername(username);
}

/**
 * Create initial test users
 */
async function createInitialUsers() {
    const testUsers = [
        { email: 'akila@gmail.com', username: 'akila', full_name: 'Akila', password: 'password123', is_management: false },
        { email: 'dinithi@gmail.com', username: 'dinithi', full_name: 'Dinithi', password: 'password123', is_management: false },
        { email: 'savishka@gmail.com', username: 'savishka', full_name: 'Savishka', password: 'password123', is_management: true },
        { email: 'chalana@gmail.com', username: 'chalana', full_name: 'Chalana', password: 'password123', is_management: false }
    ];

    let createdCount = 0;

    for (const userData of testUsers) {
        try {
            const existing = await User.findByEmail(userData.email);
            if (!existing) {
                const salt = await bcrypt.genSalt(10);
                const hashed_password = await bcrypt.hash(userData.password, salt);
                
                const user = new User({
                    email: userData.email,
                    username: userData.username,
                    full_name: userData.full_name,
                    hashed_password,
                    is_management: userData.is_management || false
                });
                
                await user.save();
                createdCount++;
                console.log(`✅ Created user: ${userData.email}`);
            }
        } catch (error) {
            // User might already exist, skip
            if (!error.message.includes('duplicate')) {
                console.log(`⚠️ Skipped ${userData.email}: ${error.message}`);
            }
        }
    }

    console.log(`📝 Initial users: ${createdCount} created`);
    return createdCount;
}

module.exports = {
    createUser,
    authenticateUser,
    getUserById,
    getUserByUsername,
    createInitialUsers
};
