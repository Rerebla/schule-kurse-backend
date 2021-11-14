import express from 'express';
// import kursbuch from './kursbuch.json';
require('dotenv').config();
const app = express();
const config = process.env;
const port = config.PORT;




app.listen(port, () => {
    console.log(`Express Server ready on port: ${port}`);
});