const express = require('express');
const cors = require('cors');
const errorHandler = require('./middlewares/errorHandler');
const buildRouter = require('./routes/crudRoutes');


const app = express();

app.use(cors());
app.use(express.json());

// Import Controllers
const departments = require('./controllers/departmentController');
const employees = require('./controllers/employeeController');
const companies = require('./controllers/companyController');
const services = require('./controllers/serviceController');
const loes = require('./controllers/loeController');
const jobs = require('./controllers/jobController');
const tasks = require('./controllers/taskController');

// Mount Routes
app.use('/api/departments', buildRouter(departments));
app.use('/api/employees', buildRouter(employees));
app.use('/api/companies', buildRouter(companies));
app.use('/api/services', buildRouter(services));
app.use('/api/loes', buildRouter(loes));
app.use('/api/jobs', buildRouter(jobs));
app.use('/api/tasks', buildRouter(tasks));

// Global Error Handler (must be last)
app.use(errorHandler);

module.exports = app;