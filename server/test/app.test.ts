jest.mock("../src/toggl_api")
jest.mock("../src/particle_api")
declare const fetch: any

import * as request from "supertest"
import app from "../src/app"
import TogglAPI from "../src/toggl_api"
import ParticleAPI from "../src/particle_api"

describe("app", () => {
  describe("GET /invalid", () => {
    it("should return 404", async () => {
      const response = await request(app).get("/invalid")
      expect(response.status).toEqual(404)
    })
  })

  describe("GET /ping", () => {
    it("should return {}", async () => {
      const response = await request(app).get("/ping")
      expect(response.status).toEqual(200)
      expect(response.body).toEqual({ message: "pong", data: {} })
    })
  })

  describe("GET /toggl/test", () => {
    it("should test Toggl API", async () => {
      ;(TogglAPI.test as any).mockResolvedValue(true)
      const response = await request(app).get("/toggl/test")
      expect(TogglAPI.test).toBeCalledWith({ token: "your Toggl API token" })
      expect(response.status).toEqual(200)
      expect(response.body).toEqual({ message: "Successfully connected to Toggl API", data: {} })
    })
  })

  describe("GET /toggl/current", () => {
    it("should return current Toggl API state", async () => {
      const mockResponseData = { entry: "Test Entry", entryId: 10, project: "Test Project", projectId: 1 }
      ;(TogglAPI.getCurrentState as any).mockResolvedValue(mockResponseData)
      const response = await request(app).get("/toggl/current")
      expect(TogglAPI.getCurrentState).toBeCalledWith({ token: "your Toggl API token" })
      expect(response.status).toEqual(200)
      expect(response.body).toEqual({ message: "OK", data: mockResponseData })
    })
  })

  describe("GET /particle/test", () => {
    it("should test Particle API", async () => {
      const mockResponseData = { online: true, ok: true }
      ;(ParticleAPI.test as any).mockResolvedValue(mockResponseData)
      const response = await request(app).get("/particle/test")
      expect(ParticleAPI.test).toBeCalledWith({
        token: "your Particle access token",
        deviceName: "your Particle device name",
      })
      expect(response.status).toEqual(200)
      expect(response.body).toEqual({ message: "Successfully connected to Particle API", data: {} })
    })
  })

  describe("GET /particle/current", () => {
    it("should return current Particle API state", async () => {
      const mockResponseData = {
        actualPosIdx: 3,
        actualPosSen: 1680,
        stateName: "STATE_CONTROL",
        targetPosIdx: 5,
      }
      ;(ParticleAPI.getCurrentState as any).mockResolvedValue(mockResponseData)
      const response = await request(app).get("/particle/current")
      expect(ParticleAPI.getCurrentState).toBeCalledWith({
        token: "your Particle access token",
        deviceName: "your Particle device name",
      })
      expect(response.status).toEqual(200)
      expect(response.body).toEqual({ message: "OK", data: mockResponseData })
    })
  })
})
