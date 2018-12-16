import ParticleAPI from "../src/particle_api"
declare const fetch: any

describe("ParticleAPI", () => {
  beforeEach(() => {
    fetch.resetMocks()
  })

  // Some fixture data to use.
  const settings = {
    token: "particle123",
    deviceName: "my-particle-device",
  }

  describe("test()", () => {
    it("should connect to Particle API", async () => {
      fetch.mockResponse(JSON.stringify({ online: true, ok: true }))
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
      expect(response).toEqual(true)
    })

    describe("when given invalid credentials", () => {
      it("should return an error", async () => {
        fetch.mockResponse(null, { status: 401 })

        await expect(ParticleAPI.test({
          token: "invalidkey",
          deviceName: "my-particle-device",
        })).rejects.toThrow("Connection to Particle API failed!")
      })
    })
  })

  describe("getCurrentState()", () => {
    it("should query all cloud variables and return the state", async () => {
      fetch.mockResponses(
        [ JSON.stringify({ name: "actualPosIdx", result: 3 }), { status: 200 }],
        [ JSON.stringify({ name: "actualPosSen", result: 1680 }), { status: 200 }],
        [ JSON.stringify({ name: "state", result: 2 }), { status: 200 }],
        [ JSON.stringify({ name: "targetPosIdx", result: 5 }), { status: 200 }],
      )

      const response = await ParticleAPI.getCurrentState(settings)
      expect(fetch.mock.calls.length).toEqual(4)
      expect(fetch.mock.calls[0][0]).toEqual("https://api.particle.io/v1/devices/my-particle-device/actualPosIdx")
      expect(fetch.mock.calls[1][0]).toEqual("https://api.particle.io/v1/devices/my-particle-device/actualPosSen")
      expect(fetch.mock.calls[2][0]).toEqual("https://api.particle.io/v1/devices/my-particle-device/state")
      expect(fetch.mock.calls[3][0]).toEqual("https://api.particle.io/v1/devices/my-particle-device/targetPosIdx")
      expect(response).toEqual({
        actualPosIdx: 3,
        actualPosSen: 1680,
        stateName: "STATE_CONTROL",
        targetPosIdx: 5,
      })
    })

    describe("when the device is unresponsive", () => {
      it("should throw an error", async () => {
        fetch.mockResponse(JSON.stringify({ error: "Timed out." }))
        await expect(ParticleAPI.getCurrentState(settings)).rejects.toThrow("Particle device timed out!")
      })
    })

    describe("when receiving an unexpected response", () => {
      it("should throw an error", async () => {
        fetch.mockResponse(JSON.stringify({
          name: "unexpectedVariableName",
          result: "mining crypto",
        }))
        await expect(ParticleAPI.getCurrentState(settings)).rejects.toThrow("Unexpected Particle response!")
      })
    })
  })

  describe("setCurrentState()", () => {
    it("sets the new target position index", async () => {
      fetch.mockResponse(JSON.stringify({ name: settings.deviceName, return_value: 0 }))
      const response = await ParticleAPI.setCurrentState({ targetPosIdx: 2 }, settings)
      expect(fetch.mock.calls.length).toEqual(1)
      expect(fetch.mock.calls[0][0]).toEqual("https://api.particle.io/v1/devices/my-particle-device/setTargetPos")
      expect(fetch.mock.calls[0][1]).toMatchObject({
        method: "POST",
        body: expect.objectContaining({ "arg": 2 })
      })
      expect(response).toBe(true)
    })

    describe("when the device returns an error", () => {
      it("should return false", async () => {
        fetch.mockResponse(JSON.stringify({ name: settings.deviceName, return_value: -1 }))
        const response = await ParticleAPI.setCurrentState({ targetPosIdx: 2 }, settings)
        expect(response).toBe(false)
      })
    })

    describe("when receiving an unexpected response", () => {
      it("should throw an error", async () => {
        fetch.mockResponse(JSON.stringify({}))
        await expect(ParticleAPI.setCurrentState({ targetPosIdx: 2 }, settings)).rejects.toThrow("Unexpected Particle response!")
      })
    })
  })
})
