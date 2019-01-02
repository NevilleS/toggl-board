# TogglBoard Device

This folder contains the design files for the TogglBoard Device with the physical controls. For more info, see the [README](../README.md)

## Schematic

![EasyEDA Schematic](./schematic/schematic_copy.png)

## BOM

| Designator | Name              | Quantity |
|------------|-------------------|----------|
| U1         | PARTICLE CORE     | 1        |
| U2         | DUAL TB6612FNG    | 1        |
| U3         | LD33CV            | 1        |
| U4         | SLIDE POT + MOTOR | 1        |
| U5         | MC74HC595ANG      | 1        |
| SW1        | SPST SWITCH       | 1        |
| LED1-8     | LED-10MM          | 8        |
| R1-8       | 60                | 11       |
| R9         | 10k               | 1        |
| R10        | 1M                | 1        |
| C1         | 100n              | 1        |
| C2         | 10u               | 1        |

## Microcontroller Code

See the [source code](./code/) for the sketch file used in the Particle Core.
