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
            voltageAttribute: 0x0017, // Attribute: 23
            //percentageAtrribute: 0x0018 // Attribute: 24 // TODO: Should confirm to be sure
        }),
        lumi.lumiModernExtend.fp1ePresence(), // Works

        modernExtend.enumLookup({
            name: "presence_detection_options",
            lookup: {both: 0, mmwave: 1, pir: 2},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0199, type: Zcl.DataType.UINT8}, // Attribute: 409
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
            attribute: {ID: 0x0197, type: Zcl.DataType.UINT32}, // Attribute: 407
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

        // Sampling parameters
        modernExtend.enumLookup({
            name: "sampling",
            lookup: {off: 0, low: 1, medium: 2, high: 3, custom: 4},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0170, type: Zcl.DataType.UINT8}, // Attribute: 368
            description: "Temperature and Humidity sampling frequency settings, changing the configuration will affect battery life. Setting it to custom allows specifying sampling interval.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "sampling_interval",
            valueMin: 0.5, // Min: 500ms
            valueMax: 3600, // Max: 1h = 3600s
            valueStep: 0.5, // Step: 500ms
            scale: 1000,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0162, type: Zcl.DataType.UINT32}, // Attribute: 354
            description: "Sampling interval for temperature and humidity when sampling is in custom mode.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        
        // Temperature
        modernExtend.numeric({
            name: "temp_interval",
            valueMin: 600, // Min: 10min = 600s
            valueMax: 3600, // Max: 1h = 3600s
            valueStep: 600, // Step: 10min = 600s
            scale: 1000,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0163, type: Zcl.DataType.UINT32}, // Attribute: 355
            description: "Custom temperature reporting interval.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "temp_threshold",
            valueMin: 0.2, // Min: 0,2 C
            valueMax: 3, // Max: 3,0 C
            valueStep: 0.1, // Step: 0,1 C
            scale: 100,
            unit: "°C",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0164, type: Zcl.DataType.UINT16}, // Attribute: 356
            description: "Reporting will trigger when temperature reaches this value when in custom mode.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.enumLookup({
            name: "temp_report_mode",
            lookup: {no: 0, threshold: 1, interval: 2, threshold_interval: 3},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0165, type: Zcl.DataType.UINT8}, // Attribute: 357
            description: "Temperature reporting mode when in custom mode.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        
        // Humidity
        modernExtend.numeric({
            name: "humi_interval",
            valueMin: 600, // Min: 10min = 600s
            valueMax: 3600, // Max: 1h = 3600s
            valueStep: 600, // Step: 10min = 600s
            scale: 1000,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x016a, type: Zcl.DataType.UINT32}, // Attribute: 362
            description: "Custom humidity reporting interval.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "humi_threshold",
            valueMin: 2, // Min: 2%
            valueMax: 10, // Max: 10%
            valueStep: 0.5, // Step: 0,5%
            scale: 100,
            unit: "%",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x016b, type: Zcl.DataType.UINT16}, // Attribute: 363
            description: "Reporting will trigger when humidity reaches this value when in custom mode.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.enumLookup({
            name: "humi_report_mode",
            lookup: {no: 0, threshold: 1, interval: 2, threshold_interval: 3},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x016c, type: Zcl.DataType.UINT8}, // Attribute: 364
            description: "Humidity reporting mode",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        // Illuminance (Offsets seem to match temperature & humidity)
        modernExtend.enumLookup({ // CONFIRMED
            name: "light_detection_sensor",
            lookup: {off: 0, low: 1, medium: 2, high: 3, custom: 4},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0192, type: Zcl.DataType.UINT8}, // Attribute: 402
            description: "Light detection frequency settings, changing the configuration will affect battery life",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "light_sampling_interval",
            valueMin: 0.5, // Min: 500ms
            valueMax: 3600, // Max: 1h = 3600s 
            valueStep: 0.5, // Step: 500ms
            scale: 1000,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0193, type: Zcl.DataType.UINT32}, // Attribute: 403
            description: "How often illuminance readings are taken in custom mode.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "light_interval",
            valueMin: 20, // Min: 20s
            valueMax: 3600, // Max: 1h = 3600s
            valueStep: 20, // Step: 20s
            scale: 1000,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0194, type: Zcl.DataType.UINT32}, // attribute 404
            description: "Interval for illuminance data reporting interval in custom mode.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "light_threshold",
            valueMin: 3, // Min: 3%
            valueMax: 20, /// Max: 20%
            valueStep: 0.5, // Step: 0,5%
            scale: 100,
            unit: "%",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0195, type: Zcl.DataType.UINT16}, // Attribute: 405
            description: "Percentage change in illuminance that will tripper data report in custom mode",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.enumLookup({
            name: "ilum_report_mode",
            lookup: {no: 0, threshold: 1, interval: 2, threshold_interval: 3},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0196, type: Zcl.DataType.UINT8}, // Attribute: 406
            description: "Illuminance reporting mode",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        
        
        // OTA
        modernExtend.quirkCheckinInterval("1_HOUR"),
        lumi.lumiModernExtend.lumiZigbeeOTA()
    ],
    meta: {},
};
