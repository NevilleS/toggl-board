import * as express from "express"
import TogglAPI from "./toggl_api"
import ParticleAPI from "./particle_api"

interface APIResponse {
  message: string
  error?: string
  data: Object
}

interface AppConfig {
  toggl: {
    token: string
  }
  particle: {
    token: string
    deviceName: string
  }
}

// Create Express app
const app = express()

// Configure Express
app.set("port", process.env.PORT || 3000)

// Middleware
function getAppConfig(): AppConfig {
  if (!process.env.TOGGL_API_TOKEN) {
    throw new Error("TOGGL_API_TOKEN is not configured")
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
  }
}

// Routes
app.get("/ping", function ping(req, res) {
  res.send({ message: "pong", data: {} })
})

app.get("/toggl/test", async function test(req, res) {
  const config = getAppConfig()
  try {
    const connected = await TogglAPI.test({ token: config.toggl.token })
    if (connected) {
      res.send({ message: "Successfully connected to Toggl API", data: {} })
      return
    }
  } catch (e) {
    var error = e
  }
  res.status(403).send({ message: "Connection to Toggl API failed!", data: {}, error })
})

app.get("/toggl/current", async function current(req, res) {
  const config = getAppConfig()
  try {
    const response = await TogglAPI.getCurrentState({ token: config.toggl.token })
    res.send({
      message: "OK",
      data: response,
    })
    return
  } catch (e) {
    var error = e
  }
  res.status(403).send({ message: "Connection to Toggl API failed!", data: {}, error })
})

app.get("/particle/test", async function test(req, res) {
  const config = getAppConfig()
  try {
    const connected = await ParticleAPI.test({
      token: config.particle.token,
      deviceName: config.particle.deviceName,
    })
    if (connected) {
      res.send({ message: "Successfully connected to Particle API", data: {} })
      return
    }
  } catch (e) {
    var error = e
  }
  res.status(403).send({ message: "Connection to Particle API failed!", data: {}, error })
})

app.get("/particle/current", async function current(req, res) {
  const config = getAppConfig()
  try {
    const response = await ParticleAPI.getCurrentState({
      token: config.particle.token,
      deviceName: config.particle.deviceName,
    })
    res.send({
      message: "OK",
      data: response,
    })
    return
  } catch (e) {
    var error = e
  }
  res.status(403).send({ message: "Connection to Particle API failed!", data: {}, error })
})

export default app
