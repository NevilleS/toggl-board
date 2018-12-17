import { TogglAPIState, TogglAPINewState } from "./toggl_api"
import { ParticleAPIState, ParticleAPINewState } from "./particle_api"
import { has } from "lodash"

const NUM_TOGGL_BOARD_PROJECTS = 7

export interface TogglBoardState {
  toggl: TogglAPIState
  particle: ParticleAPIState
  togglProjectIDs: number[]
}

type TogglBoardAction = TogglAPINewState | ParticleAPINewState | null

const TogglBoard = {
  calculateAction: function(current: TogglBoardState, previous?: TogglBoardState): TogglBoardAction {
    // Some runtime checks
    const projectId = current.toggl.projectId
    const actualPosIdx = current.particle.actualPosIdx
    const targetPosIdx = current.particle.targetPosIdx
    if (!TogglBoard.validateState(current)) {
       return null
    }

    // Convert the Toggl project to a Particle position index
    let projectIdx = TogglBoard.lookupProjectIndex(projectId, current.togglProjectIDs)
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
        return { projectId: current.togglProjectIDs[actualPosIdx - 1] }
      }
    }
    return null
  },

  validateState: function(state: TogglBoardState): boolean {
    if (!state || !has(state, "toggl") || !has(state, "particle") || !has(state, "togglProjectIDs")) {
      return false
    }
    if (!has(state.toggl, "projectId")) {
      return false
    }
    if (!has(state.particle, "actualPosIdx") || state.particle.actualPosIdx == null) {
      return false
    }
    if (!Array.isArray(state.togglProjectIDs) || state.togglProjectIDs.length != NUM_TOGGL_BOARD_PROJECTS) {
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
