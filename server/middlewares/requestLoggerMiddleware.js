// prints one line for every request when it finishes : GET /api/health 200 4ms
const requestLoggerMiddleware = (req, res, next)=>{
    const start = Date.now();

    res.on("finish", ()=>{
        // originalUrl, because inside a router req.url only holds the part after the mount path
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });

    next();
}

export default requestLoggerMiddleware;
