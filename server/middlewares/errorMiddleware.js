// Safety net : controllers handle their own errors with try/catch, this only catches
// what happens BEFORE a controller runs (for example a body that is not valid JSON)
// or anything a controller forgot to catch.
// Express knows this is an error handler because it takes 4 arguments.
const errorMiddleware = (err, req, res, next)=>{
    if(err.type === "entity.parse.failed"){
        return res.status(400).json({
            message : "Request body is not valid JSON"
        });
    }

    if(err.type === "entity.too.large"){
        return res.status(413).json({
            message : "Request body is too large"
        });
    }

    console.log(err);
    res.status(500).json({
        message : "Internal Server Error"
    });
}

export default errorMiddleware;
