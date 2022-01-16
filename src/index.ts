import express, { Request, Response } from 'express';
import cors from 'cors';
import kursbuchJSON from './kursbuch.json';
import belegteKurse from './belegteKurse.json';
import namesDOBJSON from './namesDOB.json';
require('dotenv').config();
const app = express();
const config = process.env;
const port = config.PORT;
const kursbuch = kursbuchJSON.array;
const namesDOB: { [key: string]: string; } = namesDOBJSON;
let belegteKurseJSON: { [key: string]: { "WS": string[], "SS": string[], "all": string[]; }; } = belegteKurse;
const corsOptions: cors.CorsOptions = {
    origin: "*"
};
app.use(cors(corsOptions));
app.use(express.json());

type requestBody = {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    select1SS: string;
    select1WS: string;
    select2SS: string;
    select2WS: string;
};
type ownCoursesBody = {
    firstName: string,
    lastName: string,
    dateOfBirth: string;
};

app.post("/request", (req: Request, res: Response) => {
    const body: requestBody = req.body;
    const [firstName, lastName] = getName(body); //will be treated as authenticated
    if (!firstName || !lastName) {
        //Date of Birth doesn't match with name, user is not authenticated
        return res.status(401).send("Name or date of birth wrong");
    }
    const WS = [body.select1WS, body.select2WS];
    const SS = [body.select1SS, body.select2SS];

    if (WS[0] == WS[1] || SS[0] == SS[1]) {
        //Two or all chosen courses are ident
        return res.sendStatus(400);
    }
    const student = `${firstName} ${lastName}`;
    if (getCoursesOfStudent(student)) {
        return res.status(400).send("Already enrolled, please ask a teacher to change your courses");
    }
    addCourseToStudent(student, { WS: WS, SS: SS });
    return res.sendStatus(200);
});
app.get("/courses", (_, res: Response) => { //Used for getting the still available courses in the frontend
    let filteredKursbuch = filterKursbuch();
    let courseNamesWS: string[] = [];
    let courseNamesSS: string[] = [];
    for (let course of filteredKursbuch) { //gets the courses for the winter semester
        if (!course.WS) continue;
        courseNamesWS.push(course.thema);
    }
    for (let course of filteredKursbuch) { //gets the courses for the summer semester
        if (!course.SS) continue;
        courseNamesSS.push(course.thema);
    }
    //removes empty entries from the lists
    courseNamesWS = courseNamesWS.filter(element => Boolean(element));
    courseNamesSS = courseNamesSS.filter(element => Boolean(element));
    res.status(200).send({ 'WS': courseNamesWS, 'SS': courseNamesSS });
});
app.post("/ownCourses", (req: Request, res: Response) => {
    const body: ownCoursesBody = req.body;
    const [firstName, lastName] = getName(body);
    if (!firstName || !lastName) {
        //Date of Birth doesn't match with name, user is not authenticated
        return res.status(401).send("Name or date of birth wrong");
    }
    return res.status(200).send(getCoursesOfStudent(firstName + " " + lastName));
});

/**
 * Returns the courses a given student is currently enrolled in
 * @param {string} student  The name of the student
 * @returns The courses the student is enrolled in split into WS, SS and all 
 */
function getCoursesOfStudent(student: string) {
    return belegteKurseJSON[student];
}
/**
 * Adds given courses to a given student 
 * @param student The name of the student
 * @param courses The JSON of the courses to be added in {'WS' : string[], 'SS' : string[]} format
 */
function addCourseToStudent(student: string, courses: { 'WS': string[], 'SS': string[]; }) {
    const coursesObj = { 'WS': courses.WS, 'SS': courses.SS, 'all': courses.WS.concat(courses.SS) };
    belegteKurseJSON[student] = coursesObj;
    writeBelegteKurseJSON();
}
/**
 * Deletes the given student from the JSON file
 * @param {string} student The student to be deleted
 */
function deleteStudent(student: string) {
    delete belegteKurseJSON[student];
    writeBelegteKurseJSON();
}
/**
 * Writes the current state of the belegteKurseJSON to the file for persistence 
 */
function writeBelegteKurseJSON() {
    const fs = require('fs');
    fs.writeFile("./src/belegteKurse.json", JSON.stringify(belegteKurseJSON), function (err: Error) {
        if (err) {
            console.log(err);
        }
    });
}
/**
 * Returns the course matching to the given courseIdentifier
 * If courseIdentifier is a string it will be compaired to 
 * the thema entry of the course, otherwise to the kurs_Nr entry of the course  
 * @param {string | number} courseIdentifier  Either the name of the course or the courseNumber
 * @returns The matching course object
 */
function getCourse(courseIdentifier: string | number) {
    if (typeof courseIdentifier === 'string') {
        return kursbuch.filter(element => element.thema === courseIdentifier)[0];
    }
    return kursbuch.filter(element => element.kurs_Nr === courseIdentifier)[0];
}
/**
 * Checks if the maximum number of enrolled students of a given course is reached (or exceeded)
 * @param {string} courseName The name of the course
 * @returns {boolean} True if max number reached, otherwise false
 */
function checkIfMaxNumExceeded(courseName: string) {
    const number = calculateNumberOfStudentsOfCourse(courseName);
    return number !== 0 && number >= getCourse(courseName).teilnehmer;
}
/**
*  Returns the number of students already enrolled in a given course
* @param {string} courseName Name of the course
* @returns {number} Number of students enrolled
*/
function calculateNumberOfStudentsOfCourse(courseName: string) {
    let counter = 0;
    //Loops through all students to check who is enrolled in the course
    for (let studentName of Object.keys(belegteKurseJSON)) {
        const studentCourses = belegteKurseJSON[studentName];
        if (studentCourses['all'].includes(courseName)) counter++;
    }
    return counter;
}

/**
 * Removes the courses where the maximum number of students is enrolled
 * @returns The filtered Kursbuch JSON
 */
function filterKursbuch() {
    let filteredKursbuch = kursbuch;
    filteredKursbuch = filteredKursbuch.filter(element => (!checkIfMaxNumExceeded(element.thema)) && element.findetStatt);
    return filteredKursbuch;
}
/**
 * Compares the user-provided date of birth and first/last name with the ones in namesDOB.json for authentication purposes   
 * @param {requestBody|ownCoursesBody} body The user-provided body
 * @returns If matched the first and last name of the user, if not an empty tuple 
 */
function getName(body: requestBody | ownCoursesBody) {
    const [firstName, lastName] = [body.firstName.trim().toLowerCase(), body.lastName.trim().toLowerCase()];
    const dateOfBirth = body.dateOfBirth;
    if (namesDOB[firstName + " " + lastName] != dateOfBirth) {
        return [,];
    }
    return [body.firstName.trim().toLowerCase(), body.lastName.trim().toLowerCase()];
}

app.listen(port, () => {
    console.log(`Express Server ready on port: ${port}`);
});