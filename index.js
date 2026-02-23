const express = require('express');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const mongoURI = process.env.MONGODB_URL;

// 1. Database Connection
mongoose.connect(mongoURI)
  .then(() => console.log("MongoDB Connected..."))
  .catch(err => console.error("MongoDB connection error:", err));

// 2. Schema Definition - Updated to match Feed.tsx
const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, default: 'https://images.unsplash.com/photo-1517836357463-d25dfe09ce14?auto=format&fit=crop&q=80&w=600' },
  category: { type: String, required: true },
  tags: [String],
  members: { type: Number, default: 1 },
  schedule: { type: String, default: 'TBD' },
  matchScore: { type: Number, default: 100 },
  author: { type: String, required: true } // Captured from user.name in Feed
}, { 
  timestamps: true,
  // This ensures that when the doc is converted to JSON, 
  // we can handle the _id mapping easily if needed
  toJSON: { virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id; // Copy _id value to id
      return ret;
    }
   },
  toObject: { virtuals: true }
});

const Event = mongoose.model('Event', eventSchema);
// 3. Middleware
app.use(cors()); // Simplified for typical Render usage
app.use(express.json());

// 4. Routes

// Health Check
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Backend is running on Render!'
    });
});

/** * GET all events
 * Matches fetch(EVENTS_API) in Feed.tsx
 */
app.get('/api/events', async (req, res) => {
    try {
        const events = await Event.find().sort({ createdAt: -1 });
        res.status(200).json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** * POST a new event
 * Matches handleCreateEvent in Feed.tsx
 */
app.post('/api/events', async (req, res) => {
    try {
        const newEvent = new Event(req.body);
        const savedEvent = await newEvent.save();
        res.status(201).json(savedEvent);
    } catch (err) {
        console.error("Post Error:", err);
        res.status(400).json({ error: err.message });
    }
});
/**
 * DELETE an event
 * Checks if the requester is the author before deleting
 */
app.delete('/api/events/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userName = req.headers['x-user-name']; 
        console.log(userName);

        // 1. Find the event first
        const event = await Event.findById(id);

        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // 2. Check Ownership
        // Compare the author stored in DB with the userName from the request
        if (event.author !== userName && event.author !== "admin1") {
            return res.status(403).json({ 
                message: "Permission denied. You are not the author of this event." 
            });
        }

        // 3. Delete the event
        await Event.findByIdAndDelete(id);
        
        res.status(200).json({ message: "Event deleted successfully" });

    } catch (err) {
        console.error("Delete Error:", err);
        res.status(500).json({ error: err.message });
    }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatar: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' },
  totalSteps: { type: Number, default: 0 },
  dailyGoal: { type: Number, default: 10000 },
  streakDays: { type: Number, default: 0 },
  lastActiveDate: { type: String, default: '' },
  weight: { type: Number, default: 70 },
  height: { type: Number, default: 170 },
  history: [{ date: String, steps: { type: Number, default: 0 } }]
}, { timestamps: true, toJSON: { virtuals: true } });
const User = mongoose.model('User', userSchema);
app.post('/api/users', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    let user = await User.findOne({ name });
    if (!user) user = await new User({ name }).save();
    res.status(200).json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Dashboard stats for user
app.get('/api/users/:id/dashboard', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySteps = user.history.find(h => h.date === todayStr)?.steps || 0;
    res.status(200).json({
      user: {
        name: user.name,
        avatar: user.avatar,
        todaySteps,
        dailyGoal: user.dailyGoal,
        streakDays: user.streakDays,
        percentAheadOfFriends: 68,
        caloriesBurned: parseFloat((todaySteps * user.weight * 0.0005).toFixed(2))
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sync steps + calc streak
app.post('/api/users/:id/steps', async (req, res) => {
  try {
    const { date, steps } = req.body;
    if (!date || steps === undefined) return res.status(400).json({ error: 'Date and steps required' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const idx = user.history.findIndex(h => h.date === date);
    let diff = steps;
    if (idx >= 0) { diff = steps - user.history[idx].steps; user.history[idx].steps = steps; }
    else { user.history.push({ date, steps }); }
    if (diff > 0) user.totalSteps += diff;

    // Streak logic
    if (user.lastActiveDate !== date) {
      const diffDays = user.lastActiveDate
        ? Math.ceil(Math.abs(new Date(date) - new Date(user.lastActiveDate)) / 86400000)
        : null;
      user.streakDays = diffDays === 1 ? user.streakDays + 1 : 1;
      user.lastActiveDate = date;
    }
    await user.save();
    const calories = parseFloat((steps * user.weight * 0.0005).toFixed(2));
    res.status(200).json({ user, caloriesBurned: calories });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const top = await User.find().sort({ totalSteps: -1 }).limit(10).select('name totalSteps dailyGoal');
    res.status(200).json(top);
  } catch (err) { res.status(500).json({ error: err.message }); }
});



/* --- ADD THIS TO YOUR BACKEND --- */

// Club Schema
const clubSchema = new mongoose.Schema({
  name: String,
  description: String,
  image: String,
  membersCount: { type: Number, default: 0 },
  tags: [String]
});
const Club = mongoose.model('Club', clubSchema);

// Get all clubs
app.get('/api/clubs', async (req, res) => {
  try {
    const clubs = await Club.find();
    res.json(clubs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update User (Height/Weight)
app.patch('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Join a club
app.post('/api/users/:id/clubs/:clubId/join', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const club = await Club.findById(req.params.clubId);
    if (!user || !club) return res.status(404).json({ error: 'Not found' });
    
    // Add logic here to track joined clubs if you expand the User schema
    club.membersCount += 1;
    await club.save();
    res.status(200).json({ message: 'Joined successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});