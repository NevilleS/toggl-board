jest.mock("../src/toggl_api")
declare const fetch: any

import * as request from "supertest"
import app from "../src/app"
import TogglApi from "../src/toggl_api"

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
      expect(response.body).toEqual({})
    })
  })

  describe("GET /test", () => {
    it("should test Toggl API", async () => {
      const mockResponseData = { message: "Successfully connected to Toggl API", data: {} }
      ;(TogglApi.test as any).mockResolvedValue(mockResponseData)
      const response = await request(app).get("/test")
      expect(response.status).toEqual(200)
      expect(response.body).toEqual({ message: "Successfully connected to Toggl API", data: {} })
      expect(TogglApi.test).toBeCalledWith({ apiToken: "your API token" })
    })
  })

  describe("GET /current", () => {
    it("should return current Toggl API state", async () => {
      const mockResponseData = { entry: "Test Entry", entryId: 10, project: "Test Project", projectId: 1 }
      ;(TogglApi.getCurrentState as any).mockResolvedValue(mockResponseData)
      const response = await request(app).get("/current")
      expect(response.status).toEqual(200)
      expect(response.body).toEqual({ data: mockResponseData })
      expect(TogglApi.getCurrentState).toBeCalledWith({ apiToken: "your API token" })
    })
  })
})
