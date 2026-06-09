# PiBot V3.28 Isolated 固件目录

本目录用于存放 PiBot V3.28 Isolated 使用的 GRBL v1.1h / ATmega328P 固件。

## 文件说明

### `grbl_v1.1h.hex`

GRBL 1.1h 官方默认配置版本，适合对照测试。

- Spindle PWM/Enable: D11
- Spindle Direction: D13
- Coolant Flood (M8): A3
- Coolant Mist (M7): 默认未启用

注意：官方 GRBL 1.1h 默认没有启用 M7。要让 M7 输出到 A4，必须修改源码并重新编译。

### `grbl_v1.1h_custom.hex`

PiBot V3.28 Isolated 定制版本。

目标引脚：

- D13 = Spindle Enable，高电平有效
- D11 = Spindle PWM
- A4 = Coolant Mist (M7)，高电平有效
- A3 = Coolant Flood (M8)，高电平有效

该固件必须在 GRBL 源码 `grbl/config.h` 中同时启用：

```c
#define ENABLE_M7
#define USE_SPINDLE_DIR_AS_ENABLE_PIN
```

只启用 `USE_SPINDLE_DIR_AS_ENABLE_PIN` 不够，D13 可以作为主轴使能，但 M7/A4 仍然不会工作。

## 源码补丁

补丁文件：

```text
source-patches/grbl_328p_enable_m7_spindle_enable.patch
```

补丁内容：

- 取消注释 `ENABLE_M7`
- 取消注释 `USE_SPINDLE_DIR_AS_ENABLE_PIN`

## 网页烧录

推荐使用网页中的“烧录到主板”按钮。

网页通过浏览器 Web Serial 直接访问客户电脑本机串口，并按 stk500v1 写入 ATmega328P bootloader。

常用 bootloader 波特率：

- 115200：Arduino Uno / Optiboot 常用
- 57600：部分旧 Nano bootloader 可尝试

烧录完成后，请断开并重新连接串口，再进行硬件测试。

## 手动烧录参考

如需手动烧录，可使用 avrdude：

```bash
avrdude -c arduino -p m328p -P COM3 -b 115200 -U flash:w:grbl_v1.1h_custom.hex
```

旧 bootloader 可尝试：

```bash
avrdude -c arduino -p m328p -P COM3 -b 57600 -U flash:w:grbl_v1.1h_custom.hex
```
