import * as Debug from "debug"
import * as express from "express"
import TogglBoard, { TogglBoardState, TogglBoardSettings } from "./toggl_board"
import TogglAPI from "./toggl_api"
import ParticleAPI from "./particle_api"
const debug = Debug("app")

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
  const settings = getAppSettings()
  let state: TogglBoardState | null = null

  // Routes
  app.get("/ping", function ping(req, res) {
    res.send({ message: "pong", data: {} })
  })

  app.put("/sync", async function current(req, res) {
    try {
      state = await TogglBoard.sync(state, settings)
      res.send({
        message: "OK",
        data: state,
      })
      return
    } catch (e) {
      var error = e.message
      state = null
    }
    res.status(403).send({ message: "Sync failed!", data: {}, error })
  })

  app.get("/toggl/test", async function test(req, res) {
    try {
      const connected = await TogglAPI.test(settings.toggl)
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
    try {
      const response = await TogglAPI.getCurrentState(settings.toggl)
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
    try {
      const connected = await ParticleAPI.test(settings.particle)
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
    try {
      const response = await ParticleAPI.getCurrentState(settings.particle)
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

  // Schedule periodic syncs
  let interval = setInterval(async () => {
    try {
      state = await TogglBoard.sync(state, settings)
      debug("sync success: new state (%o)", state)
    } catch (e) {
      debug("sync error: %s", e.message)
      state = null
    }
  }, settings.syncPeriodMs)

  return app
}

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
  if (!process.env.SYNC_PERIOD_MS) {
    throw new Error("SYNC_PERIOD_MS is not configured")
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
    syncPeriodMs: parseInt(process.env.SYNC_PERIOD_MS),
  }
}

