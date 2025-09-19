import {Zcl} from "zigbee-herdsman";
import * as exposes from "zigbee-herdsman-converters/lib/exposes";
import * as lumi from "zigbee-herdsman-converters/lib/lumi";
import * as modernExtend from "zigbee-herdsman-converters/lib/modernExtend";

const e = exposes.presets;
const ea = exposes.access;

const {manufacturerCode} = lumi;

export default {
    zigbeeModel: ["lumi.sensor_occupy.agl8"],
    model: "FP300",
    vendor: "Aqara",
    description: "Presence sensor FP300",
    fromZigbee: [
        lumi.fromZigbee.lumi_specific
    ],
    toZigbee: [
        lumi.toZigbee.lumi_presence,
        lumi.toZigbee.lumi_motion_sensitivity
    ],
    exposes: [
        e.power_outage_count(), // Works
        e
            .motion_sensitivity_select(["low", "medium", "high"])
            .withDescription("Presence Detection Sensitivity."), // Works
    ],
    configure: async (device, coordinatorEndpoint) => {
        const endpoint = device.getEndpoint(1);
        await endpoint.read("manuSpecificLumi", [0x00ee], {manufacturerCode: manufacturerCode}); // Read OTA data; makes the device expose more attributes related to OTA
        await endpoint.read("manuSpecificLumi", [0x010c], {manufacturerCode: manufacturerCode}); // Read motion sensitivity (change required in https://github.com/Koenkk/zigbee-herdsman-converters/blob/0755b15bf878f2261f17956efb12e52e91642cfa/src/lib/lumi.ts#L641 )
        await endpoint.read("manuSpecificLumi", [0x0142], {manufacturerCode: manufacturerCode}); // Read current presence (should adjust https://github.com/Koenkk/zigbee-herdsman-converters/blob/0755b15bf878f2261f17956efb12e52e91642cfa/src/lib/lumi.ts#L709)
        await endpoint.read("manuSpecificLumi", [0x0197], {manufacturerCode: manufacturerCode}); // Read current absence delay timer value
    },
    extend: [
        lumi.lumiModernExtend.lumiBattery({
            voltageToPercentage: {min: 2850, max: 3000},
            voltageAttribute: 23 // 24 might be the %
        }),
        lumi.lumiModernExtend.fp1ePresence(), // Works

        modernExtend.enumLookup({
            name: "presence_detection_options",
            lookup: {both: 0, mmwave: 1, pir: 2},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0199, type: Zcl.DataType.UINT8},
            description: "Presence detection sensor type",
            zigbeeCommandOptions: {manufacturerCode},
        }),

        modernExtend.numeric({
            name: "absence_delay_timer",
            valueMin: 10,
            valueMax: 300,
            valueStep: 5,
            scale: 1,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0197, type: Zcl.DataType.UINT32},
            description: "Value for delay before the device reports absence when no presence is detected",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        
        modernExtend.illuminance(), // Works
        modernExtend.humidity(), // Works
        modernExtend.temperature(), // Works
        lumi.lumiModernExtend.fp1eSpatialLearning(), // Works?
        lumi.lumiModernExtend.lumiLedIndicator(), // Works
        lumi.lumiModernExtend.fp1eRestartDevice(), // Works
        modernExtend.identify(), // Works

        // TODO: Parameters found within Climate Sensor W100
        modernExtend.numeric({
            name: "period",
            valueMin: 0.5,
            valueMax: 600, // got 600_000 - seems to match.
            valueStep: 0.5,
            scale: 1000,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0162, type: Zcl.DataType.UINT32},
            description: "Sampling period",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        
        // Temperature
        modernExtend.numeric({
            name: "temp_period",
            valueMin: 1,
            valueMax: 10, // got 3_600_000 - 1h?
            valueStep: 1,
            scale: 1000,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0163, type: Zcl.DataType.UINT32},
            description: "Temperature reporting period",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "temp_threshold",
            valueMin: 0.2,
            valueMax: 3,
            valueStep: 0.1,
            scale: 100,
            unit: "°C",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0164, type: Zcl.DataType.UINT16},
            description: "Temperature reporting threshold",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.enumLookup({
            name: "temp_report_mode",
            lookup: {no: 0, threshold: 1, period: 2, threshold_period: 3},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0165, type: Zcl.DataType.UINT8},
            description: "Temperature reporting mode",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        // Humidity
        modernExtend.numeric({
            name: "humi_period",
            valueMin: 1,
            valueMax: 10,
            valueStep: 1,
            scale: 1000,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x016a, type: Zcl.DataType.UINT32},
            description: "Temperature reporting period",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "humi_threshold",
            valueMin: 2,
            valueMax: 10,
            valueStep: 0.5,
            scale: 100,
            unit: "%",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x016b, type: Zcl.DataType.UINT16},
            description: "Humidity reporting threshold",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.enumLookup({
            name: "humi_report_mode",
            lookup: {no: 0, threshold: 1, period: 2, threshold_period: 3},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x016c, type: Zcl.DataType.UINT8},
            description: "Humidity reporting mode",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.enumLookup({
            name: "sampling",
            lookup: {low: 1, standard: 2, high: 3, custom: 4},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0170, type: Zcl.DataType.UINT8},
            description: "Temperature and Humidity sampling settings",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        // Illuminance (Offsets seem to match temperature & humidity)
        // TODO: Need to confirm
        modernExtend.numeric({
            name: "ilum_sampling_period",
            valueMin: 0.5,
            valueMax: 600, // got 10_000 - seems to match.
            valueStep: 0.5,
            scale: 1000,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0193, type: Zcl.DataType.UINT32},
            description: "Illuminance sampling period",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "ilum_period",
            valueMin: 1,
            valueMax: 10, // got 3_600_000 - 1h?
            valueStep: 1,
            scale: 1000,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0194, type: Zcl.DataType.UINT32},
            description: "Illuminance reporting period",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "ilum_threshold",
            valueMin: 2,
            valueMax: 10, /// got 1500
            valueStep: 0.5,
            scale: 100,
            unit: "%",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0195, type: Zcl.DataType.UINT16},
            description: "Illuminance reporting threshold",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.enumLookup({
            name: "ilum_report_mode",
            lookup: {no: 0, threshold: 1, period: 2, threshold_period: 3},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0196, type: Zcl.DataType.UINT8},
            description: "Illuminance reporting mode",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        
        
        // OTA
        modernExtend.quirkCheckinInterval("1_HOUR"),
        lumi.lumiModernExtend.lumiZigbeeOTA()
    ],
    meta: {},
};
