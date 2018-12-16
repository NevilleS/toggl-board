// Constants
const char* VERSION = "0.1";
int SLIDE_POSITION_MAX = 7;
int SLIDE_POSITION_MIN = 0;
// TODO: allow calibration of these points
int SLIDE_POSITION_POINTS[] = {
  0,
  410,
  1040,
  1690,
  2330,
  2990,
  3600,
  4094,
};
int SLIDE_POSITION_SLOP = 100; // +/- sensor val range to match a point
int SLIDE_POSITION_DELTA_MAX = 4095; // maximum allowable change in sensor value per loop
unsigned long LOOP_DELAY_MS = 1; // delay to slow down speed of the main loop
unsigned long CONTROL_DELTA_TIME_MIN = 1; // max control loop speed (in millis)
int CONTROL_ERROR_INTEGRAL_MAX = 100000; // max value the integral error can be per loop
int CONTROL_ERROR_DELTA_MAX = 100000; // max value the delta error can be per loop
int CONTROL_ERROR_SLOP = 20; // +/- target sensor val to end control loop
int CONTROL_NUM_LOOPS_MAX = 1000; // after N control loops, give up and return to input mode
int CONTROL_NUM_LOOPS_STABLE = 5; // after N control loops within the target range, end control loop
int CONTROL_OUTPUT_MAX = 255; // limit the maximum output sent to motor (safety first!)
float CONTROL_KP = 0.2; // controller gain for proportional error
float CONTROL_KI = 2.0; // controller gain for integral error
float CONTROL_KD = 0.005; // controller gain for derivative error

// Configure pinout
// NOTE: do not set the pinMode() with analogRead(), just use analogRead()
int PIN_MOTOR_STBY = A1;
int PIN_MOTOR_AIN1 = A2;
int PIN_MOTOR_AIN2 = A3;
int PIN_MOTOR_PWMA = A4;
int PIN_SLIDE_POSITION_SENSE = A5;
int PIN_LED_NO_PROJECT = D2;
int PIN_SHIFT_A = D3;
int PIN_SHIFT_LATCH = D4;
int PIN_SHIFT_SHIFT = D5;
int PIN_SHIFT_RESET = D6;

// Unused
// int PIN_A0 = A0;
// int PIN_A6 = A6;
// int PIN_A7 = A7;
// int PIN_D0 = D0;
// int PIN_D1 = D1;
// int PIN_D7 = D7;

// Use primary serial over USB interface for logging output
SerialLogHandler logHandler;
//SerialLogHandler logHandler(LOG_LEVEL_TRACE);

// State variables
int g_targetSlidePositionIndex = -1;  // target position index 0 - 7
int g_actualSlidePositionIndex = 0;
int g_actualSlidePositionSense = 0;
unsigned long g_prevLoopTimeMillis = 0;
int g_prevError = 0;
int g_errorIntegral = 0;
int g_numControlLoops = 0;
int g_numStableControlLoops = 0;
enum DeviceState {
  STATE_INIT,
  STATE_INPUT,
  STATE_CONTROL
};
DeviceState g_state = STATE_INIT;
DeviceState g_prevState = STATE_INIT;
String getStateName(DeviceState state);

void setup() {
  Log.info("TOGGL-BOARD DEVICE VERSION %s", VERSION);
  Log.info("TOGGL-BOARD SYSTEM VERSION %s", System.version().c_str());

  // Register Particle variables & functions
  Log.info("REGISTER SPARK VARIABLES: targetPos, actualPos");
  Particle.variable("targetPosIdx", g_targetSlidePositionIndex);
  Particle.variable("actualPosIdx", g_actualSlidePositionIndex);
  Particle.variable("actualPosSen", g_actualSlidePositionSense);
  Particle.variable("state", g_state);
  Log.info("REGISTER SPARK FUNCTION: setTargetPos");
  Particle.function("setTargetPos", setTargetPos);

  // Setup motor pins
  pinMode(PIN_MOTOR_STBY, OUTPUT);
  pinMode(PIN_MOTOR_AIN1, OUTPUT);
  pinMode(PIN_MOTOR_AIN2, OUTPUT);
  pinMode(PIN_MOTOR_PWMA, OUTPUT);
  setMotorOutput(0);

  // Setup shift register pins
  pinMode(PIN_SHIFT_A, OUTPUT);
  pinMode(PIN_SHIFT_LATCH, OUTPUT);
  pinMode(PIN_SHIFT_SHIFT, OUTPUT);
  pinMode(PIN_SHIFT_RESET, OUTPUT);
  digitalWrite(PIN_SHIFT_RESET, HIGH);
  setProjectLEDs(-1);

  // Setup state
  Log.info("PUBLISH SPARK EVENT: togglDeviceOn");
  Particle.publish("togglDeviceOn", NULL, 60, PRIVATE);
  g_state = STATE_INPUT;
  g_prevLoopTimeMillis = millis();
}

void loop() {
  // Detect state changes
  if (g_state != g_prevState) {
    Log.info(
      "loop(): state change %s -> %s",
      getStateName(g_prevState).c_str(),
      getStateName(g_state).c_str()
    );
  }

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
    default:
      Log.error("loop(): invalid state %d", g_state);
      g_state = STATE_CONTROL;
      delay(2000);
  }

  // Update loop variables, then wait a bit before looping again
  g_prevState = g_state;
  g_prevLoopTimeMillis = millis();
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
      setProjectLEDs(index);
    }
    g_actualSlidePositionIndex = index;
  } else {
    Log.trace("loopInput(): sense %d out of range of a position index", g_actualSlidePositionSense);
  }

  Log.trace(
    "loopInput(): sense %d, index %d",
    g_actualSlidePositionSense,
    g_actualSlidePositionIndex
  );
}

void resetControllerState() {
  g_prevError = 0;
  g_errorIntegral = 0;
  g_numControlLoops = 0;
  g_numStableControlLoops = 0;
  setMotorOutput(0);
}

void loopControl() {
  // Initialize control variables (if necessary)
  if (g_prevState != STATE_CONTROL) {
    Log.info("loopControl(): initialize controller");
    resetControllerState();
  }

  // Compute time since last control loop, and check that it's reasonable (avoid divide by zero!)
  int deltaTime = millis() - g_prevLoopTimeMillis;
  if (deltaTime < CONTROL_DELTA_TIME_MIN) {
    Log.error("loopControl(): deltaTime %lu too small to run controller", deltaTime);
    return;
  }

  // Calculate the current error
  int target = getTargetSenseValue();
  if (target < 0) {
    Log.error("loopControl(): invalid target value %d", target);
    return;
  }
  int actual = g_actualSlidePositionSense;
  int error = target - actual;

  // Calculate the integral error, taking care to prevent integral windup
  if (abs(error) < 500) {
    g_errorIntegral += (error * deltaTime) / 100; // NOTE: scale down by 100 so gains are similar
    if (g_errorIntegral > CONTROL_ERROR_INTEGRAL_MAX) {
      g_errorIntegral = CONTROL_ERROR_INTEGRAL_MAX;
    } else if (g_errorIntegral < (-1 * CONTROL_ERROR_INTEGRAL_MAX)) {
      g_errorIntegral = -1 * CONTROL_ERROR_INTEGRAL_MAX;
    }
  } else {
    // Large errors will "windup" the error integral, leading to overshoot
    g_errorIntegral = 0;
  }

  // Calculate the derivative error, taking care to wait for at least one loop
  int errorDelta = ((error - g_prevError) * 100) / deltaTime;
  if (g_numControlLoops < 1) {
    errorDelta = 0; // avoid a one-time incorrect delta
  }
  if (errorDelta > CONTROL_ERROR_DELTA_MAX) {
    errorDelta = CONTROL_ERROR_DELTA_MAX;
  } else if (errorDelta < (-1 * CONTROL_ERROR_DELTA_MAX)) {
    errorDelta = -1 * CONTROL_ERROR_DELTA_MAX;
  }
  g_prevError = error;

  // Compute the control value
  Log.trace(
    "loopControl(): error %d, errorIntegral %d, errorDelta %d, deltaTime %d",
    error, g_errorIntegral, errorDelta, deltaTime
  );
  int control = (error * CONTROL_KP) + (g_errorIntegral * CONTROL_KI) + (errorDelta * CONTROL_KD);
  if (control > CONTROL_OUTPUT_MAX) {
    control = CONTROL_OUTPUT_MAX;
  } else if (control < (-1 * CONTROL_OUTPUT_MAX)) {
    control = -1 * CONTROL_OUTPUT_MAX;
  }

  // Finish the control loop
  g_numControlLoops += 1;

  // Check for success state
  if (abs(error) <= CONTROL_ERROR_SLOP) {
    g_numStableControlLoops += 1;
    if (g_numStableControlLoops >= CONTROL_NUM_LOOPS_STABLE) {
      Log.info("loopControl(): achieved target in %d loops, exiting!", g_numControlLoops);
      g_targetSlidePositionIndex = -1;
      g_state = STATE_INPUT;
      resetControllerState();
      return;
    }
  } else {
    g_numStableControlLoops = 0;
  }

  // Exit control state
  if (g_numControlLoops > CONTROL_NUM_LOOPS_MAX) {
    Log.error("loopControl(): reached maximum control loops %d, giving up!", CONTROL_NUM_LOOPS_MAX);
    g_targetSlidePositionIndex = -1;
    g_state = STATE_INPUT;
    resetControllerState();
    return;
  }

  // Set the control output to the motor
  setMotorOutput(control);

  Log.info(
    "loopControl(): target %d, actual %d, error %d -> kp %.f, ki %.f, kd %.f -> control %d",
    target, actual, error,
    (error * CONTROL_KP), (g_errorIntegral * CONTROL_KI), (errorDelta * CONTROL_KD),
    control
  );

}

// Translate the target slide position to a raw sensor value
int getTargetSenseValue() {
  if (g_targetSlidePositionIndex < SLIDE_POSITION_MIN || g_targetSlidePositionIndex > SLIDE_POSITION_MAX) {
    Log.error("getTargetSenseValue(): invalid target position %d", g_targetSlidePositionIndex);
    return -1;
  }
  return SLIDE_POSITION_POINTS[g_targetSlidePositionIndex];
}

// Set the target slide position remotely via a Particle function
int setTargetPos(String command) {
  if (command.length() <= 0) {
    Log.error("setTargetPos(%s): invalid command", command.c_str());
    return -1;
  }
  int position = command.toInt();
  if (position < SLIDE_POSITION_MIN || position > SLIDE_POSITION_MAX) {
    Log.error("setTargetPos(%s): invalid position", command.c_str());
    return -1;
  }
  g_targetSlidePositionIndex = position;
  Log.info(
    "setTargetPos(%s): set target slide position to %d",
    command.c_str(),
    g_targetSlidePositionIndex
  );
  g_state = STATE_CONTROL;
  return 0;
}

// Human-readable state name
String getStateName(DeviceState state) {
  switch (g_state) {
    case (STATE_INPUT): return "STATE_INPUT";
    case (STATE_CONTROL): return "STATE_CONTROL";
    case (STATE_INIT): return "STATE_INIT";
    default: return "UNKNOWN STATE";
  }
}

void setMotorOutput(int speed) {
  if (speed > 0) {
    digitalWrite(PIN_MOTOR_STBY, HIGH);
    digitalWrite(PIN_MOTOR_AIN1, HIGH);
    digitalWrite(PIN_MOTOR_AIN2, LOW);
    analogWrite(PIN_MOTOR_PWMA, abs(speed));
  } else if (speed < 0 ) {
    digitalWrite(PIN_MOTOR_STBY, HIGH);
    digitalWrite(PIN_MOTOR_AIN1, LOW);
    digitalWrite(PIN_MOTOR_AIN2, HIGH);
    analogWrite(PIN_MOTOR_PWMA, abs(speed));
  } else {
    digitalWrite(PIN_MOTOR_STBY, LOW);
    digitalWrite(PIN_MOTOR_AIN1, LOW);
    digitalWrite(PIN_MOTOR_AIN2, LOW);
    analogWrite(PIN_MOTOR_PWMA, 0);
  }
}

void setProjectLEDs(int slidePositionIndex) {
  digitalWrite(PIN_SHIFT_LATCH, LOW);

  int output = 0;
  if (slidePositionIndex >= 0 && slidePositionIndex <= SLIDE_POSITION_MAX) {
    output = 1 << slidePositionIndex;
  }

  Log.info("setProjectLEDs(%d): output = %d", slidePositionIndex, output);
  shiftOut(PIN_SHIFT_A, PIN_SHIFT_SHIFT, MSBFIRST, output);

  digitalWrite(PIN_SHIFT_LATCH, HIGH);
}
