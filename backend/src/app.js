const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const createCrudRouter = require('./routes/crudRoutes');

const companyController = require('./controllers/companyController');
const departmentController = require('./controllers/departmentController');
const employeeController = require('./controllers/employeeController');
const serviceController = require('./controllers/serviceController');
const loeController = require('./controllers/loeController');
const jobController = require('./controllers/jobController');
const taskController = require('./controllers/taskController');
const invoiceController = require('./controllers/invoiceController');

const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// Authentication and Public Routes
app.use('/api/auth', authRoutes);

// Core Entity Routes
app.use('/api/companies', createCrudRouter(companyController));
app.use('/api/departments', createCrudRouter(departmentController));
app.use('/api/employees', createCrudRouter(employeeController));
app.use('/api/services', createCrudRouter(serviceController));
app.use('/api/loes', createCrudRouter(loeController));
app.use('/api/jobs', createCrudRouter(jobController));
app.use('/api/tasks', createCrudRouter(taskController));
app.use('/api/invoices', createCrudRouter(invoiceController));

// Global Error Handler
app.use(errorHandler);

module.exports = app;