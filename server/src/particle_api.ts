import * as Debug from "debug"
import EventSource = require("eventsource")
import { has } from "lodash"
import "isomorphic-fetch"
declare const fetch: any // NOTE: this offends my sensibilities
const debug = Debug("particle-api")

export interface ParticleAPISettings {
  token: string
  deviceName: string
}

export interface ParticleAPIState {
  actualPosIdx: number
  actualPosSen: number
  targetPosIdx: number
}

export interface ParticleAPINewState {
  targetPosIdx: number
}

export interface ParticleAPIEvent {
  type: "togglDeviceOn" | "togglDeviceActualPosIdxChange"
  data: {
    data: string
    ttl: number
    published_at: string
    coreid: string
  }
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
    const targetPosIdx = await ParticleAPI.getVariable("targetPosIdx", settings)
    return {
      actualPosIdx,
      actualPosSen,
      targetPosIdx,
    }
  },

  setCurrentState: async function(state: ParticleAPINewState, settings: ParticleAPISettings): Promise<boolean> {
    const response = await ParticleAPI.fetch(
      `https://api.particle.io/v1/devices/${settings.deviceName}/setTargetPos`,
      settings,
      {
        method: "POST",
        body: JSON.stringify({ arg: state.targetPosIdx.toString() }),
      }
    ) as any
    if (!response || !has(response, "return_value")) {
      throw new Error("Unexpected Particle response!")
    }
    return !!(response.return_value == 0)
  },

  subscribe: function(listener: (evt: ParticleAPIEvent) => Promise<void>, settings: ParticleAPISettings) {
    const source = new EventSource(`https://api.particle.io/v1/devices/${settings.deviceName}/events?access_token=${settings.token}`)
    source.addEventListener("togglDeviceOn", (e: any) => {
      debug("got togglDeviceOn event: (%o)", e)
      listener(e)
    })
    source.addEventListener("togglDeviceActualPosIdxChange", (e: any) => {
      debug("got togglDeviceActualPosIdxChange event: (%o)", e)
      listener(e)
    })
    source.onerror = (e: any) => {
      debug("error subscribing to Particle events: (%o)", e)
    }
  },

  getVariable: async function(variableName: string, settings: ParticleAPISettings): Promise<number> {
    const url = `https://api.particle.io/v1/devices/${settings.deviceName}/${variableName}`
    const response = await ParticleAPI.fetch(url, settings) as ParticleAPIVariable
    if (response && (response as any).error == "Timed out.") {
      throw new Error("Particle device timed out!")
    }
    if (!response || !has(response, "name") || !has(response, "result") || response.name != variableName) {
      throw new Error("Unexpected Particle response!")
    }
    return response.result
  },

  // TODO: extract into shared API helpers
  fetch: async function(url: string, settings: ParticleAPISettings, opts = {}): Promise<Object> {
    const fetchOpts: any = Object.assign({
      method: "GET",
      headers: ParticleAPI.getHeaders(settings)
    }, opts)
    debug("fetch request: %s %s (%o)", fetchOpts.method, url, fetchOpts.body)
    const response = await fetch(url, fetchOpts)
    if (response && response.ok) {
      const json = await response.json()
      debug("fetch response: HTTP %s (%o)", response.status, json)
      return json
    } else {
      if (response && response.hasBody) {
        var text = await response.text()
      }
      debug("fetch error: HTTP %s (%s)", response.status, text)
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
