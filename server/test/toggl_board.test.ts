jest.mock("../src/toggl_api")
jest.mock("../src/particle_api")
import TogglBoard, { TogglBoardState, TogglBoardSettings } from "../src/toggl_board"
import TogglAPI from "../src/toggl_api"
import ParticleAPI from "../src/particle_api"
import { omit } from "lodash"

describe("TogglBoard", () => {
  // Default, valid, in-sync initial state
  let state: TogglBoardState
  let settings: TogglBoardSettings
  beforeEach(() => {
    state = {
      toggl: {
        entry: "My current entry",
        entryId: 9000,
        project: "Project 1",
        projectId: 1000,
      },
      particle: {
        actualPosIdx: 1,
        actualPosSen: 100,
        targetPosIdx: -1,
      },
    }
    settings = {
      toggl: {
        token: "toggl token",
      },
      particle: {
        token: "particle token",
        deviceName: "particle-device",
      },
      togglProjectIDs: [
        1000,
        2000,
        3000,
        4000,
        5000,
        6000,
        7000,
      ],
      syncPeriodMs: 5000,
    }
  })

  describe("sync()", () => {
    beforeEach(() => {
      ;(TogglAPI.getCurrentState as any).mockResolvedValue(state.toggl)
      ;(ParticleAPI.getCurrentState as any).mockResolvedValue(state.particle)
      ;(TogglAPI.setCurrentState as any).mockResolvedValue(state.toggl)
      ;(ParticleAPI.setCurrentState as any).mockResolvedValue(state.particle)
    })

    it("should pull the latest API state from both Toggl and Particle", async () => {
      const result = await TogglBoard.sync(state, settings)
      expect(TogglAPI.getCurrentState).toBeCalledWith(settings.toggl)
      expect(ParticleAPI.getCurrentState).toBeCalledWith(settings.particle)
    })

    it("should not call the Toggl or Particle API if already in sync", async () => {
      const result = await TogglBoard.sync(state, settings)
      expect(TogglAPI.setCurrentState).not.toBeCalled()
      expect(ParticleAPI.setCurrentState).not.toBeCalled()
    })

    it("should call the Particle API if the Toggl state changes", async () => {
      ;(TogglAPI.getCurrentState as any).mockResolvedValue(Object.assign({}, state.toggl, { projectId: 7000 }))
      const result = await TogglBoard.sync(state, settings)
      expect(TogglAPI.setCurrentState).not.toBeCalled()
      expect(ParticleAPI.setCurrentState).toBeCalled()
    })

    it("should call the Toggl API if the Particle state changes", async () => {
      ;(ParticleAPI.getCurrentState as any).mockResolvedValue(Object.assign({}, state.particle, { actualPosIdx: 5 }))
      const result = await TogglBoard.sync(state, settings)
      expect(TogglAPI.setCurrentState).toBeCalled()
      expect(ParticleAPI.setCurrentState).not.toBeCalled()
    })
  })

  describe("validateState()", () => {
    it("should return true for a valid, normal state", () => {
      expect(TogglBoard.validateState(state, settings)).toBe(true)
    })

    it("should return false if either API states have missing values", () => {
      expect(TogglBoard.validateState(omit(state, "toggl") as any, settings)).toBe(false)
      expect(TogglBoard.validateState(omit(state, "particle") as any, settings)).toBe(false)
      expect(TogglBoard.validateState(Object.assign({}, state, { particle: { actualPosIdx: null } }), settings)).toBe(false)
    })

    it("should return false if the project ID mapping is not the expected size", () => {
      expect(TogglBoard.validateState(state, Object.assign({}, settings, { togglProjectIDs: [] }))).toBe(false)
      expect(TogglBoard.validateState(state, Object.assign({}, settings, { togglProjectIDs: [1,2,3] }))).toBe(false)
      expect(TogglBoard.validateState(state, Object.assign({}, settings, { togglProjectIDs: [1,2,3,4,5,6,7] }))).toBe(true)
      expect(TogglBoard.validateState(state, Object.assign({}, settings, { togglProjectIDs: [1,2,3,4,5,6,7,8] }))).toBe(false)
    })
  })

  describe("calculateAction()", () => {
    describe("when calculating with no previous state", () => {
      it("does nothing if both APIs are already in sync", () => {
        const result = TogglBoard.calculateAction(state, null, settings)
        expect(result).toBe(null)
      })

      it("overrides Particle state if the APIs are out of sync", () => {
        const result = TogglBoard.calculateAction(Object.assign({}, state, { particle: { actualPosIdx: 5 } }), null, settings)
        expect(result).toEqual({ targetPosIdx: 1 })
      })
    })

    describe("when the previous state is unchanged", () => {
      it("does nothing if the states match exactly", () => {
        const result = TogglBoard.calculateAction(state, state, settings)
        expect(result).toBe(null)
      })

      it("ignores Toggl entry changes with the same project", () => {
        const result1 = TogglBoard.calculateAction(Object.assign({}, state, { toggl: { entryId: 999 } }), state, settings)
        expect(result1).toBe(null)
        const result2 = TogglBoard.calculateAction(Object.assign({}, state, { toggl: { entry: "My changed entry" } }), state, settings)
        expect(result2).toBe(null)
      })

      it("ignores Particle sensor changes", () => {
        const result = TogglBoard.calculateAction(Object.assign({}, state, { particle: { actualPosSen: 150 } }), state, settings)
        expect(result).toBe(null)
      })
    })

    describe("when the Particle state changes", () => {
      it("updates the Toggl state", () => {
        const result = TogglBoard.calculateAction(Object.assign({}, state, { particle: { actualPosIdx: 7 } }), state, settings)
        expect(result).toEqual({ projectId: 7000 })
      })

      it("stops the Toggl entry when the position goes to zero", () => {
        const result = TogglBoard.calculateAction(Object.assign({}, state, { particle: { actualPosIdx: 0 } }), state, settings)
        expect(result).toEqual({ projectId: null })
      })
    })

    describe("when the Toggl state changes", () => {
      it("updates the Particle state", () => {
        const result = TogglBoard.calculateAction(Object.assign({}, state, { toggl: { projectId: 4000 } }), state, settings)
        expect(result).toEqual({ targetPosIdx: 4 })
      })

      it("continues to update the Particle state", () => {
        const result = TogglBoard.calculateAction(
          Object.assign({}, state, { toggl: { projectId: 4000 } }),
          Object.assign({}, state, { toggl: { projectId: 4000 } }),
          settings,
        )
        expect(result).toEqual({ targetPosIdx: 4 })
      })

      it("sets the Particle state to zero when the Toggl project is unknown", () => {
        const result = TogglBoard.calculateAction(Object.assign({}, state, { toggl: { projectId: 9000 } }), state, settings)
        expect(result).toEqual({ targetPosIdx: 0 })
      })

      it("sets the Particle state to zero when the Toggl project is null", () => {
        const result = TogglBoard.calculateAction(Object.assign({}, state, { toggl: { projectId: null } }), state, settings)
        expect(result).toEqual({ targetPosIdx: 0 })
      })
    })

    describe("when both states change", () => {
      it("overrides the Particle state", () => {
        const result = TogglBoard.calculateAction(
          Object.assign({}, state, { toggl: { projectId: 2000 }, particle: { actualPosIdx: 7 } }),
          state,
          settings,
        )
        expect(result).toEqual({ targetPosIdx: 2 })
      })
    })

    describe.skip("when the Particle state goes offline", () => {
      it("overrides the Particle state when it comes back online", () => {
      })
    })
  })
})
