import * as express from "express"
import TogglBoard, { TogglBoardState, TogglBoardSettings } from "./toggl_board"
import TogglAPI from "./toggl_api"
import ParticleAPI from "./particle_api"

interface APIResponse {
  message: string
  error?: string
  data: Object
}

export default function App() {
  // Create Express app
  const app = express()

  // Configure Express
  app.set("port", process.env.PORT || 3000)
  app.set("togglBoardState", null)

  // Middleware
  function getAppSettings(): TogglBoardSettings {
    if (!process.env.TOGGL_API_TOKEN) {
      throw new Error("TOGGL_API_TOKEN is not configured")
    }
    if (!process.env.TOGGL_PROJECT_IDS) {
      throw new Error("TOGGL_PROJECT_IDS is not configured")
    }
    if (!process.env.PARTICLE_API_TOKEN) {
      throw new Error("PARTICLE_API_TOKEN is not configured")
    }
    if (!process.env.PARTICLE_DEVICE_NAME) {
      throw new Error("PARTICLE_DEVICE_NAME is not configured")
    }
    return {
      toggl: {
        token: process.env.TOGGL_API_TOKEN,
      },
      particle: {
        token: process.env.PARTICLE_API_TOKEN,
        deviceName: process.env.PARTICLE_DEVICE_NAME,
      },
      togglProjectIDs: process.env.TOGGL_PROJECT_IDS.split(",").map(e => parseInt(e.trim())).filter(e => e),
    }
  }

  // Routes
  app.get("/ping", function ping(req, res) {
    res.send({ message: "pong", data: {} })
  })

  app.get("/sync", async function current(req, res) {
    const settings = getAppSettings()
    const state = app.get("togglBoardState") as TogglBoardState
    try {
      const newState = await TogglBoard.sync(state, settings)
      app.set("togglBoardState", newState)
      res.send({
        message: "OK",
        data: newState,
      })
      return
    } catch (e) {
      var error = e.message
    }
    res.status(403).send({ message: "Sync failed!", data: {}, error })
  })

  app.get("/toggl/test", async function test(req, res) {
    const settings = getAppSettings()
    try {
      const connected = await TogglAPI.test({ token: settings.toggl.token })
      if (connected) {
        res.send({ message: "Successfully connected to Toggl API", data: {} })
        return
      }
    } catch (e) {
      var error = e.message
    }
    res.status(403).send({ message: "Connection to Toggl API failed!", data: {}, error })
  })

  app.get("/toggl/current", async function current(req, res) {
    const settings = getAppSettings()
    try {
      const response = await TogglAPI.getCurrentState({ token: settings.toggl.token })
      res.send({
        message: "OK",
        data: response,
      })
      return
    } catch (e) {
      var error = e.message
    }
    res.status(403).send({ message: "Connection to Toggl API failed!", data: {}, error })
  })

  app.get("/particle/test", async function test(req, res) {
    const settings = getAppSettings()
    try {
      const connected = await ParticleAPI.test({
        token: settings.particle.token,
        deviceName: settings.particle.deviceName,
      })
      if (connected) {
        res.send({ message: "Successfully connected to Particle API", data: {} })
        return
      }
    } catch (e) {
      var error = e.message
    }
    res.status(403).send({ message: "Connection to Particle API failed!", data: {}, error })
  })

  app.get("/particle/current", async function current(req, res) {
    const settings = getAppSettings()
    try {
      const response = await ParticleAPI.getCurrentState({
        token: settings.particle.token,
        deviceName: settings.particle.deviceName,
      })
      res.send({
        message: "OK",
        data: response,
      })
      return
    } catch (e) {
      var error = e.message
    }
    res.status(403).send({ message: "Connection to Particle API failed!", data: {}, error })
  })

  return app
}
