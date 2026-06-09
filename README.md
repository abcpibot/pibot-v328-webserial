# PiBot V3.28 Isolated Web Serial Firmware & Test Platform

Static Web Serial firmware download, flashing, serial terminal, and hardware test page for the PiBot V3.28 Isolated ATmega328P controller board.

Live site after GitHub Pages is enabled:

```text
https://abcpibot.github.io/pibot-v328-webserial/
```

Chinese auxiliary page:

```text
https://abcpibot.github.io/pibot-v328-webserial/zh-cn.html
```

## Features

- English homepage for international customers
- Chinese auxiliary page
- GRBL v1.1h official firmware download
- PiBot V3.28 Isolated custom firmware download
- Web Serial direct flashing for ATmega328P bootloader
- Serial terminal for GRBL commands
- XYZ limit, probe, abort, hold, and resume input monitoring
- M3/M4/M5 spindle output testing
- M7(A4), M8(A3), and M9 coolant output testing
- XYZ EN / DIR / CLK signal testing

## Customer Requirements

- Chrome or Edge browser
- HTTPS website
- CH340 / CH341 USB serial driver when required

Official CH340/CH341 driver:

```text
https://www.wch-ic.com/downloads/CH341SER.ZIP.html
```

Local driver package in this repository:

```text
CH341SER.zip
```

## Deployment

This is a static website. Upload the repository contents to GitHub Pages or any HTTPS static hosting service.

GitHub Pages settings:

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

Web Serial requires HTTPS. Plain HTTP pages cannot access the serial port.

## Firmware Notes

The PiBot V3.28 Isolated custom firmware uses:

- D13 = Spindle Enable, active high
- D11 = Spindle PWM
- A4 = Coolant Mist (M7), active high
- A3 = Coolant Flood (M8), active high

The GRBL source file `grbl/config.h` must enable:

```c
#define ENABLE_M7
#define USE_SPINDLE_DIR_AS_ENABLE_PIN
```

Enabling only `USE_SPINDLE_DIR_AS_ENABLE_PIN` is not enough. M7/A4 requires `ENABLE_M7`.

## Project Structure

```text
index.html          English homepage
zh-cn.html          Chinese auxiliary page
css/                Page styles
js/                 Web Serial, flashing, and test logic
assets/brand/       PiBot logo and favicon
firmware/           HEX firmware files and source patch notes
CH341SER.zip        Local CH340/CH341 driver package
```

The old local Python proxy and exe client workflow has been removed. This project keeps only the Web Serial mode.

Local Chinese notes such as `说明.txt` and `客户使用说明.txt` are kept for internal reference and are intentionally not published in this repository.
