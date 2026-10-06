require('dotenv').config(); // MUST BE AT THE VERY TOP

const app = require('./app'); 

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});