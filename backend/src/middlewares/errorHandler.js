const errorHandler = (err, req, res, next) => {
    console.error(err);
    
    if (err.code === 'P2002') {
        return res.status(409).json({ 
            error: 'Unique constraint failed. Record already exists.' 
        });
    }
    
    if (err.code === 'P2025') {
        return res.status(404).json({ 
            error: 'Record not found.' 
        });
    }
    
    res.status(500).json({ 
        error: err.message || 'Internal Server Error' 
    });
};

module.exports = errorHandler;