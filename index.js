const express = require('express');
const cors = require('cors');

const app = express();
// Render assigns a dynamic port via the PORT environment variable
const PORT = process.env.PORT || 3000;

// Middleware setup
// Enable CORS for all routes. We can restrict the 'origin' later 
// when the frontend and mobile apps are deployed.
app.use(cors({
  origin: '*', // Specify your frontend/app domains here later, e.g., 'https://your-frontend.vercel.app'
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json());

// Routes
// Root route / health check (useful for Render deployment checks)
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'success', 
    message: 'Backend is running on Render!' 
  });
});

// Example API route
app.get('/api/status', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is operational'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
