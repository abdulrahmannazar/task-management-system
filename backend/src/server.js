// 1. Import or define the app first
const app = require('./app'); 
// (If your routes and express setup are in this file, they go here)

// 2. Define the port
const PORT = process.env.PORT || 3000;

// 3. Start the server AT THE END
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});