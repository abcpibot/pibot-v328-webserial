# PiBot V3.28 Isolated Firmware Directory

This directory contains GRBL v1.1h / ATmega328P firmware files for the PiBot V3.28 Isolated controller board.

## Files

### `grbl_v1.1h.hex`

Official GRBL v1.1h build with the standard default pin mapping. It is useful as a reference firmware for comparison and testing.

- Spindle PWM/Enable: D11
- Spindle Direction: D13
- Coolant Flood (M8): A3
- Coolant Mist (M7): disabled by default

Important: official GRBL v1.1h does not enable M7 by default. To output M7 on A4, the source code must be modified and rebuilt.

### `grbl_v1.1h_custom.hex`

Custom firmware for the PiBot V3.28 Isolated board.

Target pin mapping:

- D13 = Spindle Enable, active high
- D11 = Spindle PWM
- A4 = Coolant Mist (M7), active high
- A3 = Coolant Flood (M8), active high

The GRBL source file `grbl/config.h` must enable both options:

```c
#define ENABLE_M7
#define USE_SPINDLE_DIR_AS_ENABLE_PIN
```

Enabling only `USE_SPINDLE_DIR_AS_ENABLE_PIN` is not enough. D13 can work as spindle enable, but M7/A4 will still not work unless `ENABLE_M7` is also enabled.

## Source Patch

Patch file:

```text
source-patches/grbl_328p_enable_m7_spindle_enable.patch
```

Patch purpose:

- Enable `ENABLE_M7`
- Enable `USE_SPINDLE_DIR_AS_ENABLE_PIN`

The patch documentation is here:

```text
source-patches/README.md
```

## Web Serial Flashing

The recommended method is to use the "Flash to Board" button on the web page.

The page uses the browser Web Serial API to access the customer's local serial port and writes the ATmega328P bootloader with the stk500v1 protocol.

Common bootloader baud rates:

- 115200: common for Arduino Uno / Optiboot
- 57600: used by some older Nano bootloaders

Before flashing, close Arduino IDE, XLoader, serial monitor tools, and any other software that may occupy the COM port.

After flashing, reconnect the serial port before hardware testing.

## Manual Flashing Reference

If manual flashing is required, avrdude can be used:

```bash
avrdude -c arduino -p m328p -P COM3 -b 115200 -U flash:w:grbl_v1.1h_custom.hex
```

For older bootloaders, try 57600:

```bash
avrdude -c arduino -p m328p -P COM3 -b 57600 -U flash:w:grbl_v1.1h_custom.hex
```


中文辅助说明
============

本目录用于存放 PiBot V3.28 Isolated 使用的 GRBL v1.1h / ATmega328P 固件。

`grbl_v1.1h.hex` 是官方默认配置版本，用于对照测试：
- Spindle PWM/Enable: D11
- Spindle Direction: D13
- Coolant Flood (M8): A3
- Coolant Mist (M7): 默认未启用

`grbl_v1.1h_custom.hex` 是 PiBot V3.28 Isolated 定制版本：
- D13 = Spindle Enable，高电平有效
- D11 = Spindle PWM
- A4 = Coolant Mist (M7)，高电平有效
- A3 = Coolant Flood (M8)，高电平有效

GRBL 源码 `grbl/config.h` 必须同时启用：

```c
#define ENABLE_M7
#define USE_SPINDLE_DIR_AS_ENABLE_PIN
```

只启用 `USE_SPINDLE_DIR_AS_ENABLE_PIN` 不够，D13 可以作为主轴使能，但 M7/A4 仍然不会工作。
