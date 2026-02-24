require('dotenv').config();
const mongoose = require('mongoose');

async function checkDb() {
  await mongoose.connect(process.env.MONGODB_URL);
  
  const eventSchema = new mongoose.Schema({
      title: { type: String, required: true },
      description: { type: String, required: true },
      image: { type: String, default: 'https://images.unsplash.com/photo-1517836357463-d25dfe09ce14?auto=format&fit=crop&q=80&w=600' },
      category: { type: String, required: true },
      tags: [String],
      members: { type: Number, default: 1 },
      joinedUsers: [String], // Array of usernames who have joined
      schedule: { type: String, default: 'TBD' },
      matchScore: { type: Number, default: 100 },
      author: { type: String, required: true }, // Captured from user.name in Feed
      lat: { type: Number },
      lng: { type: Number }
  });
  const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

  const events = await Event.find().sort({ createdAt: -1 }).limit(1);
  if(events.length > 0) {
      console.log("Latest Event DB Record:");
      console.log(JSON.stringify(events[0], null, 2));
      console.log("Joined Users Array:", events[0].joinedUsers);
  } else {
      console.log("No events found");
  }
  process.exit(0);
}

checkDb().catch(console.error);
