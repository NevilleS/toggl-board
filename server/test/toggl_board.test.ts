import TogglBoard, { TogglBoardState } from "../src/toggl_board"
import { omit } from "lodash"

describe("TogglBoard", () => {
  // Default, valid, in-sync initial state
  let state: TogglBoardState
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
        stateName: "STATE_INPUT",
        targetPosIdx: -1,
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
    }
  })

  describe("validateState()", () => {
    it("should return true for a valid, normal state", () => {
      expect(TogglBoard.validateState(state)).toBe(true)
    })

    it("should return false if either API states have missing values", () => {
      expect(TogglBoard.validateState(omit(state, "toggl") as any)).toBe(false)
      expect(TogglBoard.validateState(omit(state, "particle") as any)).toBe(false)
      expect(TogglBoard.validateState(Object.assign({}, state, { particle: { actualPosIdx: null } }))).toBe(false)
    })

    it("should return false if the project ID mapping is not the expected size", () => {
      expect(TogglBoard.validateState(Object.assign({}, state, { togglProjectIDs: [] }))).toBe(false)
      expect(TogglBoard.validateState(Object.assign({}, state, { togglProjectIDs: [1,2,3] }))).toBe(false)
      expect(TogglBoard.validateState(Object.assign({}, state, { togglProjectIDs: [1,2,3,4,5,6,7] }))).toBe(true)
      expect(TogglBoard.validateState(Object.assign({}, state, { togglProjectIDs: [1,2,3,4,5,6,7,8] }))).toBe(false)
    })
  })

  describe("calculateAction()", () => {
    describe("when calculating with no previous state", () => {
      it("does nothing if both APIs are already in sync", () => {
        const result = TogglBoard.calculateAction(state)
        expect(result).toBe(null)
      })

      it("overrides Particle state if the APIs are out of sync", () => {
        const result = TogglBoard.calculateAction(Object.assign({}, state, { particle: { actualPosIdx: 5 } }))
        expect(result).toEqual({ targetPosIdx: 1 })
      })
    })

    describe("when the previous state is unchanged", () => {
      it("does nothing if the states match exactly", () => {
        const result = TogglBoard.calculateAction(state, state)
        expect(result).toBe(null)
      })

      it("ignores Toggl entry changes with the same project", () => {
        const result1 = TogglBoard.calculateAction(Object.assign({}, state, { toggl: { entryId: 999 } }), state)
        expect(result1).toBe(null)
        const result2 = TogglBoard.calculateAction(Object.assign({}, state, { toggl: { entry: "My changed entry" } }), state)
        expect(result2).toBe(null)
      })

      it("ignores Particle sensor and state changes", () => {
        const result1 = TogglBoard.calculateAction(Object.assign({}, state, { particle: { actualPosSen: 150 } }), state)
        expect(result1).toBe(null)
        const result2 = TogglBoard.calculateAction(Object.assign({}, state, { particle: { stateName: "STATE_INIT" } }), state)
        expect(result2).toBe(null)
      })
    })

    describe("when the Particle state changes", () => {
      it("updates the Toggl state", () => {
        const result = TogglBoard.calculateAction(Object.assign({}, state, { particle: { actualPosIdx: 7 } }), state)
        expect(result).toEqual({ projectId: 7000 })
      })

      it("stops the Toggl entry when the position goes to zero", () => {
        const result = TogglBoard.calculateAction(Object.assign({}, state, { particle: { actualPosIdx: 0 } }), state)
        expect(result).toEqual({ projectId: null })
      })
    })

    describe("when the Toggl state changes", () => {
      it("updates the Particle state", () => {
        const result = TogglBoard.calculateAction(Object.assign({}, state, { toggl: { projectId: 4000 } }), state)
        expect(result).toEqual({ targetPosIdx: 4 })
      })

      it("continues to update the Particle state", () => {
        const result = TogglBoard.calculateAction(
          Object.assign({}, state, { toggl: { projectId: 4000 } }),
          Object.assign({}, state, { toggl: { projectId: 4000 } }),
        )
        expect(result).toEqual({ targetPosIdx: 4 })
      })

      it("sets the Particle state to zero when the Toggl project is unknown", () => {
        const result = TogglBoard.calculateAction(Object.assign({}, state, { toggl: { projectId: 9000 } }), state)
        expect(result).toEqual({ targetPosIdx: 0 })
      })

      it("sets the Particle state to zero when the Toggl project is null", () => {
        const result = TogglBoard.calculateAction(Object.assign({}, state, { toggl: { projectId: null } }), state)
        expect(result).toEqual({ targetPosIdx: 0 })
      })
    })

    describe("when both states change", () => {
      it("overrides the Particle state", () => {
        const result = TogglBoard.calculateAction(
          Object.assign({}, state, { toggl: { projectId: 2000 }, particle: { actualPosIdx: 7 } }),
          state
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
