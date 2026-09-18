// runs when no route matched the request
const notFoundMiddleware = (req, res)=>{
    res.status(404).json({
        message : `Route not found : ${req.method} ${req.originalUrl}`
    });
}

export default notFoundMiddleware;
