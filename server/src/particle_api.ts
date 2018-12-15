import "isomorphic-fetch"
import { isEqual } from "lodash"
declare const fetch: any // NOTE: this offends my sensibilities

interface ParticleAPISettings {
  token: string
  deviceName: string
}

interface ParticleAPIState {
  actualPosIdx: number
  actualPosSen: number
  stateName: "STATE_INIT" | "STATE_INPUT" | "STATE_CONTROL"
  targetPosIdx: number
}

interface ParticleAPINewState {
  targetPosIdx: number
}

interface ParticleAPIVariable {
  name: string
  result: number
  coreInfo: {
    name: string
    deviceID: string
    connected: boolean
    last_handshake_at: string
    last_app: string
  }
}

const ParticleAPI = {
  test: async function(settings: ParticleAPISettings): Promise<boolean> {
    const response = await ParticleAPI.fetch(
      `https://api.particle.io/v1/devices/${settings.deviceName}/ping`,
      settings,
      {
        method: "PUT",
      }
    ) as any
    if (response && response.online) {
      return true
    }
    return false
  },

  getCurrentState: async function(settings: ParticleAPISettings): Promise<ParticleAPIState> {
    const actualPosIdx = await ParticleAPI.getVariable("actualPosIdx", settings)
    const actualPosSen = await ParticleAPI.getVariable("actualPosSen", settings)
    const state = await ParticleAPI.getVariable("state", settings)
    const targetPosIdx = await ParticleAPI.getVariable("targetPosIdx", settings)
    return {
      actualPosIdx,
      actualPosSen,
      stateName: ParticleAPI.getStateName(state),
      targetPosIdx,
    }
  },

  setCurrentState: async function(state: ParticleAPINewState, settings: ParticleAPISettings): Promise<ParticleAPIState> {
    // TODO: call setTargetPosIdx
    return await ParticleAPI.getCurrentState(settings)
  },

  getVariable: async function(variableName: string, settings: ParticleAPISettings): Promise<number> {
    const url = `https://api.particle.io/v1/devices/${settings.deviceName}/${variableName}`
    const response = await ParticleAPI.fetch(url, settings) as ParticleAPIVariable
    if (response && (response as any).error == "Timed out.") {
      throw new Error("Particle device timed out!")
    }
    if (!response || !response.name || !response.result || response.name != variableName) {
      throw new Error("Unexpected Particle response!")
    }
    return response.result
  },

  // TODO: verify this is how the Particle enums work
  getStateName: function(state: number) {
    switch(state) {
      case 0: return "STATE_INIT"
      case 1: return "STATE_INPUT"
      case 2: return "STATE_CONTROL"
      default: throw new Error("Unexpected Particle response!")
    }
  },

  // TODO: extract into shared API helpers
  fetch: async function(url: string, settings: ParticleAPISettings, opts = {}): Promise<Object> {
    const response = await fetch(url, Object.assign({
      method: "GET",
      headers: ParticleAPI.getHeaders(settings),
    }, opts))
    if (response && response.ok) {
      const json = await response.json()
      return json
    } else {
      throw new Error("Connection to Particle API failed!")
    }
  },

  getHeaders: function(settings: ParticleAPISettings): Object {
    return {
      "Authorization": `Bearer ${settings.token}`,
      "Content-Type": "application/json",
    }
  },
}

export default ParticleAPI
