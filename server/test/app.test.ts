jest.mock("../src/toggl_api")
jest.mock("../src/particle_api")
jest.mock("../src/toggl_board")
declare const fetch: any

import * as request from "supertest"
import App from "../src/app"
import TogglAPI from "../src/toggl_api"
import ParticleAPI from "../src/particle_api"
import TogglBoard, { TogglBoardState } from "../src/toggl_board"

describe("app", () => {
  // Re-create the express app for each test
  let app: any
  beforeEach(() => {
    app = App()
  })

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

  describe("GET /sync", () => {
    let state: TogglBoardState
    beforeEach(() => {
      state = {
        toggl: {
          entry: "Test Entry",
          entryId: 10,
          project: "Test Project",
          projectId: 1,
        },
        particle: {
          actualPosIdx: 3,
          actualPosSen: 1680,
          targetPosIdx: 5,
        },
      }
    })

    it("should run a sync", async () => {
      ;(TogglBoard.sync as any).mockResolvedValue(state)
      const response = await request(app).get("/sync")
      expect(TogglBoard.sync).toBeCalledWith(
        null,
        {
          toggl: {
            token: "your Toggl API token"
          },
          particle: {
            token: "your Particle access token",
            deviceName: "your Particle device name",
          },
          togglProjectIDs: [ 2, 3, 5, 7, 11, 13, 17 ],
        },
      )
      expect(response.status).toEqual(200)
      expect(response.body).toEqual({ message: "OK", data: state })
    })

    it("should store the returned state and provide in future calls", async () => {
      ;(TogglBoard.sync as any).mockResolvedValue(state)

      // First request -> will get the "new state"
      const response1 = await request(app).get("/sync")
      expect(TogglBoard.sync).toBeCalledWith(null, expect.anything())
      expect(response1.status).toEqual(200)

      // Second request -> should pass along the "new state"
      const response2 = await request(app).get("/sync")
      expect(TogglBoard.sync).toBeCalledWith(state, expect.anything())
      expect(response2.status).toEqual(200)
      expect(response2.body).toEqual({ message: "OK", data: state })
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

  it.skip("should run a sync every 30 seconds", () => {
  })

  it.skip("should run a sync whenever Particle publishes a new event", () => {
  })
})
