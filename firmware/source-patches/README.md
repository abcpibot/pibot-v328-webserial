# GRBL 328P custom firmware patch

The custom firmware for this board must be built from GRBL 1.1h source with both options enabled in `grbl/config.h`:

```c
#define ENABLE_M7
#define USE_SPINDLE_DIR_AS_ENABLE_PIN
```

Why:

- `ENABLE_M7` enables mist coolant `M7` on Arduino Uno/ATmega328P analog pin `A4`.
- `USE_SPINDLE_DIR_AS_ENABLE_PIN` changes `D13/PB5` from spindle direction to spindle enable.

Use `grbl_328p_enable_m7_spindle_enable.patch` against the official GRBL source before compiling the new `.hex`.

Note: if a previously compiled `grbl_v1.1h_custom.hex` only enabled `USE_SPINDLE_DIR_AS_ENABLE_PIN`, then `M7`/A4 will still not work. Rebuild the hex after applying this patch.
