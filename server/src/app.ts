import * as express from "express"
import TogglApi from "./toggl_api"

// Create Express app
const app = express()

// Configure Express
app.set("port", process.env.PORT || 3000)

// Routes
app.get("/ping", function ping(req, res) {
  res.send("{}")
})

app.get("/test", async function test(req, res) {
  const apiToken = process.env.TOGGL_API_TOKEN
  if (!apiToken) {
    throw new Error("TOGGL_API_TOKEN is not configured")
  }
  const response = await TogglApi.test({ apiToken: apiToken })
  res.send(response)
})

app.get("/current", async function current(req, res) {
  const apiToken = process.env.TOGGL_API_TOKEN
  if (!apiToken) {
    throw new Error("TOGGL_API_TOKEN is not configured")
  }
  const response = await TogglApi.getCurrentState({ apiToken: apiToken })
  res.send({
    data: response
  })
})

export default app
