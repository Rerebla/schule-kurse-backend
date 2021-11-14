import express, { Request, Response } from 'express';
import cors from 'cors';
// import kursbuch from './kursbuch.json';
require('dotenv').config();
const app = express();
const config = process.env;
const port = config.PORT;
const corsOptions: cors.CorsOptions = {
    origin: "*"
};
app.use(cors(corsOptions));
app.use(express.json());
interface requestBody {
    firstName: string;
    lastName: string;
    select1SS: string;
    select1WS: string;
    select2SS: string;
    select2WS: string;
}
app.post("/request", (req: Request, res: Response) => {
    const body: requestBody = req.body;
    console.log(body);
    res.sendStatus(200);
});


app.listen(port, () => {
    console.log(`Express Server ready on port: ${port}`);
});