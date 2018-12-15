import ParticleAPI from "../src/particle_api"
declare const fetch: any

describe("ParticleAPI", () => {
  beforeEach(() => {
    fetch.resetMocks()
  })

  // Some fixture data to use.
  const settings = {
    apiToken: "particle123",
    deviceName: "my-particle-device",
  }

  describe("test()", () => {
    it("should connect to Particle API", async () => {
      const mockResponseData = { online: true, ok: true }
      fetch.mockResponse(JSON.stringify(mockResponseData))

      const response = await ParticleAPI.test(settings)
      expect(fetch.mock.calls.length).toEqual(1)
      expect(fetch.mock.calls[0][0]).toEqual("https://api.particle.io/v1/devices/my-particle-device/ping")
      expect(fetch.mock.calls[0][1]).toEqual({
        method: "PUT",
        headers: {
          "Authorization": "Bearer particle123",
          "Content-Type": "application/json",
        },
      })
      expect(response).toEqual(mockResponseData)
    })
  })

  describe("when given invalid credentials", () => {
    it("should return an error", async () => {
      fetch.mockResponse(null, { status: 401 })

      await expect(ParticleAPI.test({
        apiToken: "invalidkey",
        deviceName: "my-particle-device",
      })).rejects.toThrow("Connection to Particle API failed!")
    })
  })
})
