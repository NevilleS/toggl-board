import "isomorphic-fetch"
import { isEqual } from "lodash"
declare const fetch: any // NOTE: this offends my sensibilities

interface ParticleAPISettings {
  apiToken: string
  deviceName: string
}

interface ParticleAPIState {
  targetPosIdx: number
  actualPosIdx: number
  actualPosSen: number
}

const ParticleAPI = {
  test: async function(settings: ParticleAPISettings): Promise<Object> {
    const response = await ParticleAPI.fetch(
      `https://api.particle.io/v1/devices/${settings.deviceName}/ping`,
      settings,
      {
        method: "PUT",
      }
    )
    return response
  },

  // TODO: extract into shared API helpers
  fetch: async function(url: string, settings: ParticleAPISettings, opts = {}): Promise<Object> {
    const response = await fetch(url, Object.assign({
      method: "GET",
      headers: ParticleAPI.getHeaders(settings),
    }, opts))
    if (response.ok) {
      const json = await response.json()
      return json
    } else {
      throw new Error("Connection to Particle API failed!")
    }
  },

  getHeaders: function(settings: ParticleAPISettings): Object {
    return {
      "Authorization": `Bearer ${settings.apiToken}`,
      "Content-Type": "application/json",
    }
  },
}

export default ParticleAPI
