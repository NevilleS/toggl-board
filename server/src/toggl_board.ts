import * as Debug from "debug"
import { has } from "lodash"
import TogglAPI, { TogglAPIState, TogglAPINewState, TogglAPISettings } from "./toggl_api"
import ParticleAPI, { ParticleAPIState, ParticleAPINewState, ParticleAPISettings } from "./particle_api"
const debug = Debug("toggl-board")

const NUM_TOGGL_BOARD_PROJECTS = 7

export interface TogglBoardState {
  toggl: TogglAPIState
  particle: ParticleAPIState
}

export interface TogglBoardSettings {
  toggl: TogglAPISettings
  particle: ParticleAPISettings
  togglProjectIDs: number[]
}

type TogglBoardAction = TogglAPINewState | ParticleAPINewState | null

const TogglBoard = {
  sync: async function(previous: TogglBoardState | null, settings: TogglBoardSettings): Promise<TogglBoardState> {
    // Get the new state of both APIs
    const toggl = await TogglAPI.getCurrentState(settings.toggl)
    const particle = await ParticleAPI.getCurrentState(settings.particle)
    const current = { toggl, particle }

    // Calculate the action to take
    const action = TogglBoard.calculateAction(current, previous, settings)
    debug("sync action: %o", action)

    // Apply the action
    if (action && has(action, "projectId")) {
      const newTogglState = action as TogglAPINewState
      await TogglAPI.setCurrentState(newTogglState, settings.toggl)
    } else if (action && has(action, "targetPosIdx")) {
      const newParticleState = action as ParticleAPINewState
      await ParticleAPI.setCurrentState(newParticleState, settings.particle)
    }

    // Return the current state
    return current
  },

  calculateAction: function(current: TogglBoardState, previous: TogglBoardState | null, settings: TogglBoardSettings): TogglBoardAction {
    // Some runtime checks
    const projectId = current.toggl.projectId
    const actualPosIdx = current.particle.actualPosIdx
    const targetPosIdx = current.particle.targetPosIdx
    if (!TogglBoard.validateState(current, settings)) {
       return null
    }

    // Convert the Toggl project to a Particle position index
    let projectIdx = TogglBoard.lookupProjectIndex(projectId, settings.togglProjectIDs)
    if (projectIdx < 0 || projectIdx >= NUM_TOGGL_BOARD_PROJECTS) {
      projectIdx = 0
    } else {
      projectIdx += 1 // zeroth position is used for no matching project
    }

    // Early exit if everything matches
    if (projectIdx == actualPosIdx) {
      return null
    }

    // If no previous state exists, override Particle state
    if (typeof(previous) === undefined || previous == null) {
      return { targetPosIdx: projectIdx }
    }

    // Override either the Toggl or Particle state depending on what changed
    const isTogglChange = (projectId != previous.toggl.projectId)
    const isParticleChange = (actualPosIdx != previous.particle.actualPosIdx)
    if (isTogglChange || (!isTogglChange && !isParticleChange)) {
      return { targetPosIdx: projectIdx }
    } else if (isParticleChange) {
      if (actualPosIdx == 0) {
        return { projectId: null }
      } else {
        return { projectId: settings.togglProjectIDs[actualPosIdx - 1] }
      }
    }
    return null
  },

  validateState: function(state: TogglBoardState, settings: TogglBoardSettings): boolean {
    if (!state || !has(state, "toggl") || !has(state, "particle") || !has(settings, "togglProjectIDs")) {
      return false
    }
    if (!has(state.toggl, "projectId")) {
      return false
    }
    if (!has(state.particle, "actualPosIdx") || state.particle.actualPosIdx == null) {
      return false
    }
    if (!Array.isArray(settings.togglProjectIDs) || settings.togglProjectIDs.length != NUM_TOGGL_BOARD_PROJECTS) {
      return false
    }
    return true
  },

  lookupProjectIndex: function(projectId: number | null, togglProjectIDs: number[]) : number {
    if (projectId == null) {
      return -1
    }
    return togglProjectIDs.findIndex(e => e == projectId)
  },
}

export default TogglBoard
