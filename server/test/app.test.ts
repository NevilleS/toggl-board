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
    jest.useFakeTimers()
    jest.clearAllTimers()
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

  describe("PUT /sync", () => {
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
      const response = await request(app).put("/sync")
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
          syncPeriodMs: 5000,
        },
      )
      expect(response.status).toEqual(200)
      expect(response.body).toEqual({ message: "OK", data: state })
    })

    it("should store the returned state and provide in future calls", async () => {
      // First request -> will get the "new state"
      ;(TogglBoard.sync as any).mockResolvedValue(state)
      const response1 = await request(app).put("/sync")
      expect(TogglBoard.sync).toBeCalledWith(null, expect.anything())
      expect(response1.status).toEqual(200)

      // Second request -> should pass along the "new state"
      const response2 = await request(app).put("/sync")
      expect(TogglBoard.sync).toBeCalledWith(state, expect.anything())
      expect(response2.status).toEqual(200)
      expect(response2.body).toEqual({ message: "OK", data: state })
    })

    it("should catch errors and set the stored state to null for future calls", async () => {
      const sync: any = TogglBoard.sync as any

      // First request -> will get the "new state"
      sync.mockResolvedValueOnce(state)
      const response1 = await request(app).put("/sync")
      expect(response1.status).toEqual(200)

      // Second request -> should catch the error
      sync.mockRejectedValue(new Error("I can't believe you've done this!"))
      const response2 = await request(app).put("/sync")
      expect(response2.status).toEqual(403)
      expect(response2.body).toEqual({ message: "Sync failed!", data: {}, error: "I can't believe you've done this!" })

      // Third request -> should pass in null state again
      const response3 = await request(app).put("/sync")
      expect(sync.mock.calls.length).toEqual(3)
      expect(sync.mock.calls[0][0]).toEqual(null)
      expect(sync.mock.calls[1][0]).toEqual(state)
      expect(sync.mock.calls[2][0]).toEqual(null)
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

  describe("GET /toggl/user", () => {
    it("should return current Toggl API user", async () => {
      const mockResponseData = {
        api_token: "mocktoken",
        email: "mock.user@example.com",
        projects: [
         { active: true, id: 1, name : "Mock Project 1" },
         { active: true, id: 2, name : "Mock Project 2" },
        ]
      }
      ;(TogglAPI.getCurrentUser as any).mockResolvedValue(mockResponseData)
      const response = await request(app).get("/toggl/user")
      expect(TogglAPI.getCurrentUser).toBeCalledWith({ token: "your Toggl API token" })
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

  it("should run a sync every SYNC_PERIOD_MS milliseconds", () => {
    if (!process.env.SYNC_PERIOD_MS) {
      throw new Error("Invalid test configuration of SYNC_PERIOD_MS!")
    }
    const testPeriod = parseInt(process.env.SYNC_PERIOD_MS)
    ;(TogglBoard.sync as any).mockResolvedValue(null)

    jest.advanceTimersByTime(testPeriod / 2)
    expect(TogglBoard.sync).not.toBeCalled()

    jest.advanceTimersByTime(testPeriod / 2 )
    expect(TogglBoard.sync).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(testPeriod)
    expect(TogglBoard.sync).toHaveBeenCalledTimes(2);
  })

  describe("when subscribing to Particle API events", () => {
    let appCallback: any = null
    beforeEach(() => {
      ;(ParticleAPI.subscribe as any).mockImplementation((listener: any, settings: any) => {
        appCallback = listener
        return true
      })
      app = App()
    })

    it("should call subscribe on startup", () => {
      expect(ParticleAPI.subscribe).toBeCalled()
    })

    it("should run a sync whenever the Particle API event listener is called", () => {
      expect(TogglBoard.sync).not.toBeCalled()
      expect(appCallback).not.toBeNull()
      appCallback({ type: "togglDeviceOn", data: {} })
      expect(TogglBoard.sync).toBeCalled()
    })
  })
})
