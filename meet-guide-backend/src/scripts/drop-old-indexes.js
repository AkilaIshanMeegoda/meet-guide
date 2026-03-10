/**
 * Drop old indexes from meetings collection
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function dropOldIndexes() {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://meetguide:Sliit123@cluster0.rybodnc.mongodb.net/meetguide?retryWrites=true&w=majority';
        
        await mongoose.connect(mongoURI, {
            dbName: 'meetguide'
        });
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('meetings');
        
        // Get current indexes
        const indexes = await collection.indexes();
        console.log('\nCurrent indexes:', indexes.map(idx => idx.name));
        
        // Drop old room_id index
        try {
            await collection.dropIndex('room_id_1');
            console.log('✅ Dropped old room_id_1 index');
        } catch (err) {
            console.log('ℹ️ room_id_1 index does not exist or already dropped');
        }

        // Get updated indexes
        const newIndexes = await collection.indexes();
        console.log('\nRemaining indexes:', newIndexes.map(idx => idx.name));
        
        await mongoose.disconnect();
        console.log('\n✅ Done!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

dropOldIndexes();
