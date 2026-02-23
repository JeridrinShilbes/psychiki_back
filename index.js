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
        if (event.author !== userName) {
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
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});