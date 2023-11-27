const express = require("express");
const app = express();
const { open } = require("sqlite");
const path = require("path");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
app.use(express.json());

const dbpath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const InitializeAndStartServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`dberror : ${e.message}`);
    process.exit(1);
  }
};
InitializeAndStartServer();

const middleFunction = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];

    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "kavyadanuguri", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          next();
        }
      });
    }
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userQuery = `
       SELECT *
       FROM user
       WHERE
       username = '${username}';`;
  const result = await db.get(userQuery);

  if (result !== undefined) {
    const hashedPassword = await bcrypt.compare(password, result.password);
    if (hashedPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "kavyadanuguri");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

const convertDbObjectToResponseObject = (object) => {
  return {
    stateId: object.state_id,
    stateName: object.state_name,
    population: object.population,
  };
};

//API GET

app.get("/states/", middleFunction, async (request, response) => {
  const statesList = `
        select *
        from state
    `;
  const statesArray = await db.all(statesList);
  response.send(
    statesArray.map((eachPlayer) => convertDbObjectToResponseObject(eachPlayer))
  );
});

//API GET ONE

app.get("/states/:stateId/", middleFunction, async (request, response) => {
  const { stateId } = request.params;
  const stateList = `
        SELECT
           *
        FROM 
          state
        WHERE 
          state_id = ${stateId};`;
  const states = await db.get(stateList);
  response.send(convertDbObjectToResponseObject(states));
});

//API POST

app.post("/districts/", middleFunction, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrict = `
      INSERT INTO
      district (district_name, state_id, cases, cured, active, deaths)
      VALUES
      (
        '${districtName}',
         ${stateId},
         ${cases},
         ${cured},
         ${active},
         ${deaths}
      );`;
  const insertDetails = await db.run(addDistrict);
  response.send("District Successfully Added");
});

const convertDbObjectToResponseObject1 = (object) => {
  return {
    districtId: object.district_id,
    districtName: object.district_name,
    stateId: object.state_id,
    cases: object.cases,
    cured: object.cured,
    active: object.active,
    deaths: object.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  middleFunction,
  async (request, response) => {
    const { districtId } = request.params;
    const districtList = `
        SELECT
           *
        FROM 
          district
        WHERE 
          district_id = ${districtId};`;
    const district = await db.get(districtList);
    response.send(convertDbObjectToResponseObject1(district));
  }
);

//API DELETE
app.delete(
  "/districts/:districtId/",
  middleFunction,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDetails = `
     DELETE FROM 
       district
     WHERE 
        district_id = ${districtId};`;
    await db.run(deleteDetails);
    response.send("District Removed");
  }
);

//API PUT
app.put(
  "/districts/:districtId/",
  middleFunction,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const updateDistrictDetails = `
        UPDATE
          district
        SET
         district_name = '${districtName}',
         state_id = ${stateId},
         cases =${cases},
         cured= ${cured},
         active = ${active},
         deaths =${deaths}
        WHERE
         district_id = ${districtId};`;

    await db.run(updateDistrictDetails);
    response.send("District Details Updated");
  }
);

const convertToCamelCase = (obj) => {
  return {
    totalCases: obj.cases,
    totalCured: obj.cured,
    totalActive: obj.active,
    totalDeaths: obj.deaths,
  };
};

app.get(
  "/states/:stateId/stats/",
  middleFunction,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateNames = `
        SELECT SUM(cases) as cases, SUM(cured) as cured, SUM(active) as active, SUM(deaths) as deaths
        from district
        where 
       state_id = ${stateId};`;

    const stateNames = await db.get(getStateNames);
    response.send(convertToCamelCase(stateNames));
  }
);

module.exports = app;
