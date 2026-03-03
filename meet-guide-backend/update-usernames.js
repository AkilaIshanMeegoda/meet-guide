const mongoose = require('mongoose');

async function updateUsernames() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect('mongodb+srv://meetguide:Sliit123@cluster0.rybodnc.mongodb.net/?retryWrites=true&w=majority');
        console.log('✅ Connected to MongoDB');
        
        const db = mongoose.connection.db;
        
        // Check current data
        console.log('\n=== CHECKING CURRENT DATA ===');
        const users = await db.collection('users').find({}).toArray();
        console.log('Users:', users.map(u => ({ email: u.email, username: u.username })));
        
        const meetings = await db.collection('meetings').find({}).toArray();
        console.log('Meetings:', meetings.map(m => ({ 
            id: m.meeting_id, 
            host_email: m.host_email,
            participants: m.participants.map(p => p.email)
        })));
        
        const feedback = await db.collection('pronunciationfeedbacks').find({}).toArray();
        console.log('Pronunciation Feedback:', feedback.map(f => ({ 
            meeting: f.meeting_id, 
            user_name: f.user_name 
        })));
        
        // Update pronunciation feedback user_name to email format
        console.log('\n=== UPDATING PRONUNCIATION FEEDBACK ===');
        const updates = [
            { old: 'Chalana', new: 'chalana@gmail.com' },
            { old: 'chalana', new: 'chalana@gmail.com' },
            { old: 'Savishka', new: 'savishka@gmail.com' },
            { old: 'savishka', new: 'savishka@gmail.com' },
            { old: 'Dinithi', new: 'dinithi@gmail.com' },
            { old: 'dinithi', new: 'dinithi@gmail.com' },
            { old: 'Akila', new: 'akila@gmail.com' },
            { old: 'akila', new: 'akila@gmail.com' }
        ];
        
        for (const update of updates) {
            const result = await db.collection('pronunciationfeedbacks').updateMany(
                { user_name: update.old },
                { $set: { user_name: update.new } }
            );
            if (result.modifiedCount > 0) {
                console.log(`Updated ${result.modifiedCount} feedback records: ${update.old} -> ${update.new}`);
            }
        }
        
        // Update meeting participants
        console.log('\n=== UPDATING MEETING PARTICIPANTS ===');
        for (const meeting of meetings) {
            let updated = false;
            const newParticipants = meeting.participants.map(p => {
                if (p.email && !p.email.includes('@')) {
                    updated = true;
                    return {
                        ...p,
                        email: `${p.email.toLowerCase()}@gmail.com`,
                        username: `${p.email.toLowerCase()}@gmail.com`
                    };
                }
                return p;
            });
            
            if (updated) {
                await db.collection('meetings').updateOne(
                    { _id: meeting._id },
                    { $set: { participants: newParticipants } }
                );
                console.log(`Updated participants for meeting: ${meeting.meeting_id}`);
            }
        }
        
        // Verify updates
        console.log('\n=== VERIFICATION ===');
        const updatedFeedback = await db.collection('pronunciationfeedbacks').find({}).toArray();
        console.log('Updated Feedback:', updatedFeedback.map(f => ({ 
            meeting: f.meeting_id, 
            user_name: f.user_name 
        })));
        
        console.log('\n✅ All updates completed successfully!');
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

updateUsernames();
