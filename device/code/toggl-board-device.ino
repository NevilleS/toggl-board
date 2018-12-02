// Constants
const char* VERSION = "0.1";
int SLIDE_POSITION_MAX = 8;
int SLIDE_POSITION_MIN = 0;
// TODO: allow calibration of these points
int SLIDE_POSITION_POINTS[] = {
  0,
  512,
  1024,
  1536,
  2048,
  2560,
  3072,
  3584,
  4095,
};
int SLIDE_POSITION_SLOP = 100; // +/- sensor val range to match a point
int SLIDE_POSITION_DELTA_MAX = 100; // maximum allowable change in sensor value per loop
unsigned long LOOP_DELAY_MS = 500; // delay to slow down speed of the main loop
unsigned long CONTROL_DELTA_TIME_MIN = 10; // max control loop speed (in millis)
float CONTROL_KP = 0.1;
float CONTROL_KI = 0.1;
float CONTROL_KD = 0.1;

// Configure pinout
// NOTE: do not set the pinMode() with analogRead(), just use analogRead()
int PIN_SLIDE_POSITION_SENSE = A0;
int PIN_A1 = A1;
int PIN_A2 = A2;
int PIN_A3 = A3;
int PIN_A4 = A4;
int PIN_A5 = A5;
int PIN_A6 = A6;
int PIN_A7 = A7;
int PIN_D0 = D0;
int PIN_D1 = D1;
int PIN_D2 = D2;
int PIN_D3 = D3;
int PIN_D4 = D4;
int PIN_D5 = D5;
int PIN_D6 = D6;
int PIN_D7 = D7;

// Use primary serial over USB interface for logging output
SerialLogHandler logHandler;

// State variables
int g_targetSlidePositionIndex = 0;  // target position index 0 - 8
int g_actualSlidePositionIndex = 0;
int g_actualSlidePositionSense = 0;
unsigned long g_prevLoopTimeMillis = 0;
int g_prevError = 0;
int g_errorIntegral = 0;
int g_numControlLoops = 0;
enum DeviceState {
  STATE_CONTROL,
  STATE_INPUT,
  STATE_CALIBRATE,
  STATE_INIT
};
DeviceState g_state = STATE_INIT;
DeviceState g_prevState = STATE_INIT;
String getStateName(DeviceState state);

void setup() {
  Log.info("START setup()");
  Log.info("TOGGL-BOARD DEVICE VERSION %s", VERSION);
  Log.info("TOGGL-BOARD SYSTEM VERSION %s", System.version().c_str());

  // Register Particle variables & functions
  Log.info("REGISTER SPARK VARIABLES: targetPos, actualPos");
  Particle.variable("targetPosIdx", g_targetSlidePositionIndex);
  Particle.variable("actualPosIdx", g_actualSlidePositionIndex);
  Particle.variable("actualPosSen", g_actualSlidePositionSense);
  Log.info("REGISTER SPARK FUNCTION: setTargetPos");
  Particle.function("setTargetPos", setTargetPos);

  // Setup
  Log.info("PUBLISH SPARK EVENT: togglDeviceOn");
  Particle.publish("togglDeviceOn", NULL, 60, PRIVATE);
  g_state = STATE_INPUT;
  g_prevLoopTimeMillis = millis();
  Log.info("EXIT setup()");
}

void loop() {
  // Start by updating the current sensor values
  updateSenseValues();

  // Run main state machine
  switch (g_state) {
    case (STATE_INPUT):
      loopInput();
      break;
    case (STATE_CONTROL):
      loopControl();
      break;
    case (STATE_CALIBRATE):
      loopCalibrate();
      break;
    default:
      Log.error("loop(): invalid state %d", g_state);
      g_state = STATE_CONTROL;
      delay(2000);
  }

  // Update state accordingly
  if (g_state != g_prevState) {
    Log.info(
      "loop(): state change %s -> %s",
      getStateName(g_prevState).c_str(),
      getStateName(g_state).c_str()
    );
  }
  g_prevState = g_state;
  g_prevLoopTimeMillis = millis();

  // Wait a bit before looping again
  delay(LOOP_DELAY_MS);
}

void updateSenseValues() {
  // Smooth out sense value using a maximum delta
  int newSense = analogRead(PIN_SLIDE_POSITION_SENSE); // analogRead range: 0-4095
  int deltaSense = newSense - g_actualSlidePositionSense;
  if (deltaSense > SLIDE_POSITION_DELTA_MAX) {
    deltaSense = SLIDE_POSITION_DELTA_MAX;
  }
  g_actualSlidePositionSense += deltaSense;
}

void loopInput() {
  Log.info("START loopInput()");

  // Check to see if we're in range (within +/- SLIDE_POSITION_SLOP) of a slide position
  int index = -1;
  for (int i = 0; i <= SLIDE_POSITION_MAX; ++i) {
    if (g_actualSlidePositionSense >= (SLIDE_POSITION_POINTS[i] - SLIDE_POSITION_SLOP) &&
        g_actualSlidePositionSense <= (SLIDE_POSITION_POINTS[i] + SLIDE_POSITION_SLOP)) {
      index = i;
      break;
    }
  }

  // If we match a position, check to see when it changes
  if (index >= SLIDE_POSITION_MIN && index <= SLIDE_POSITION_MAX) {
    if (g_actualSlidePositionIndex != index) {
      Log.info("loopInput(): input index change %d -> %d", g_actualSlidePositionIndex, index);
      Log.info("PUBLISH SPARK EVENT: togglDeviceActualPosIdxChange");
      Particle.publish("togglDeviceActualPosIdxChange", String(index), 60, PRIVATE);
    }
    g_actualSlidePositionIndex = index;
  } else {
    Log.info("loopInput(): sense %d out of range of a position index", g_actualSlidePositionSense);
  }

  Log.info(
    "EXIT loopInput(): sense %d, index %d",
    g_actualSlidePositionSense,
    g_actualSlidePositionIndex
  );
}

void loopControl() {
  Log.info("START loopControl()");

  // Initialize control variables (if necessary)
  if (g_prevState != STATE_CONTROL) {
    Log.info("loopControl(): initialize controller");
    g_prevError = 0;
    g_errorIntegral = 0;
    g_numControlLoops = 0;
  }

  // Compute time since last control loop, and check that it's reasonable (avoid divide by zero!)
  unsigned long deltaTime = g_prevLoopTimeMillis - millis();
  if (deltaTime < CONTROL_DELTA_TIME_MIN) {
    Log.error("EXIT loopControl(): deltaTime %lu too small to run controller", deltaTime);
    return;
  }

  // Calculate the current error, derivative error, and integral error
  int target = getTargetSenseValue();
  if (target < 0) {
    Log.error("EXIT loopControl(): invalid target value %d", target);
    return;
  }
  int actual = g_actualSlidePositionSense;
  int error = target - actual;
  int errorDelta = (error - g_prevError) / deltaTime;
  g_errorIntegral += (error * deltaTime);
  g_prevError = error;

  // Compute the control value
  Log.info(
    "loopControl(): error %d, errorDelta %d, errorIntegral %d",
    error, errorDelta, g_errorIntegral
  );
  int control = 0;
  // TODO: Compute the actual control value based on gains

  Log.info(
    "EXIT loopControl(): target %d, actual %d, error %d -> control %d",
    target, actual, error, control
  );
}

void loopCalibrate() {
  Log.info("START loopCalibrate()");
  Log.error("loopCalibrate(): not implemented!");
  g_state = STATE_INPUT;
  Log.info("EXIT loopCalibrate()");
}

// Translate the target slide position to a raw sensor value
int getTargetSenseValue() {
  if (g_targetSlidePositionIndex < SLIDE_POSITION_MIN || g_targetSlidePositionIndex > SLIDE_POSITION_MAX) {
    Log.error("EXIT getTargetSenseValue(): invalid target position %d", g_targetSlidePositionIndex);
    return -1;
  }
  return SLIDE_POSITION_POINTS[g_targetSlidePositionIndex];
}

// Set the target slide position remotely via a Particle function
int setTargetPos(String command) {
  Log.info("START setTargetPos(%s)", command.c_str());
  if (command.length() <= 0) {
    Log.error("EXIT setTargetPos(%s): invalid command", command.c_str());
    return -1;
  }
  int position = command.toInt();
  if (position < SLIDE_POSITION_MIN || position > SLIDE_POSITION_MAX) {
    Log.error("EXIT setTargetPos(%s): invalid position", command.c_str());
    return -1;
  }
  g_targetSlidePositionIndex = position;
  Log.info(
    "EXIT setTargetPos(%s): set target slide position to %d",
    command.c_str(),
    g_targetSlidePositionIndex
  );
  return 0;
}

// Human-readable state name
String getStateName(DeviceState state) {
  switch (g_state) {
    case (STATE_INPUT): return "STATE_INPUT";
    case (STATE_CONTROL): return "STATE_CONTROL";
    case (STATE_CALIBRATE): return "STATE_CALIBRATE";
    case (STATE_INIT): return "STATE_INIT";
    default: return "UNKNOWN STATE";
  }
}

