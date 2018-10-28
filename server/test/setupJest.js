// Use .env.test for testing
const dotenv = require('dotenv')
dotenv.config({ path: ".env.test" })

// Use jest-fetch-mock to mock out node-fetch
global.fetch = require("jest-fetch-mock")

