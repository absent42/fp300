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
        await endpoint.read("manuSpecificLumi", [0x019a], {manufacturerCode: manufacturerCode}); // Read detection range
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
            name: "light_sampling",
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
            name: "light_report_mode",
            lookup: {no: 0, threshold: 1, interval: 2, threshold_interval: 3},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0196, type: Zcl.DataType.UINT8}, // Attribute: 406
            description: "Illuminance reporting mode",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        
        // Read current target distance
        modernExtend.binary({
            name: "track_target_distance",
            valueOn: ["ON", 1],
            valueOff: ["OFF", 0],
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0198, type: 0x20}, // Attribute: 408
            description: "Track current target distance",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        /*{
            isModernExtend: true,
            exposes: [e.enum("track_target_distance", ea.SET, ["Start Tracking Distance"]).withDescription("Initiate current target distance tracking.")],
            toZigbee: [
                {
                    key: ["track_target_distance"],
                    convertSet: async (entity, key, value, meta) => {
                        // Uint8: 1 (0x08) attribute 0x0198 = 408
                        await entity.write("manuSpecificLumi", {408: {value: 1, type: 0x20}}, {manufacturerCode: manufacturerCode});
                    },
                },
            ],
        },*/
        lumi.lumiModernExtend.fp1eTargetDistance(), // Same attribute. Need to send 0x0198 to start tracking

        // Detection Range
        {
            isModernExtend: true,
            exposes: [
                // 2^0 = 0.00 - 0.25m    2^8  = 2.00 - 2.25m    2^16 = 4.00 - 4.25m
                // 2^1 = 0.25 - 0.50m    2^9  = 2.25 - 2.50m    2^17 = 4.25 - 4.50m
                // 2^2 = 0.50 - 0.75m    2^10 = 2.50 - 2.75m    2^18 = 4.50 - 4.75m
                // 2^3 = 0.75 - 1.00m    2^11 = 2.75 - 3.00m    2^19 = 4.75 - 5.00m
                // 2^4 = 1.00 - 1.25m    2^12 = 3.00 - 3.25m    2^20 = 5.00 - 5.25m
                // 2^5 = 1.25 - 1.50m    2^13 = 3.25 - 3.50m    2^21 = 5.25 - 5.50m
                // 2^6 = 1.50 - 1.75m    2^14 = 3.50 - 3.75m    2^22 = 5.50 - 5.75m
                // 2^7 = 1.75 - 2.00m    2^15 = 3.75 - 4.00m    2^23 = 5.75 - 6.00m
                e
                    .numeric('detection_range', ea.ALL)
                    .withValueMin(0)
                    .withValueMax((1 << 24) - 1)
                    .withValueStep(1)
                    .withDescription("Specifies the range that is being detected. Requires mmWave radar mode.")
            ],
            fromZigbee: [
                {
                    cluster: "manuSpecificLumi",
                    type: ["attributeReport", "readResponse"],
                    convert: async (model, msg, publish, options, meta) => {
                        if (msg.data["410"] && Buffer.isBuffer(msg.data["410"])) {
                            const buffer = msg.data["410"]
                            return {
                                detection_range_prefix: (buffer.length > 0) ? buffer.readIntLE(0, 2) : 0x0300,
                                detection_range: (buffer.length > 0) ? buffer.readIntLE(2, 3) : 0xFFFFFF
                            }
                        }
                    },
                }
            ],
            toZigbee: [
                {
                    key: ["detection_range"],
                    convertSet: async (entity, key, value, meta) => {
                        const buffer = Buffer.allocUnsafe(5)
                        buffer.writeUIntLE(meta.state?.detection_range_prefix ?? 0x0300, 0, 2)
                        buffer.writeUIntLE(value, 2, 3)

                        await entity.write("manuSpecificLumi", {
                            410: {value: buffer, type: 0x41}
                        }, {manufacturerCode: manufacturerCode});
                    },
                    convertGet: async (entity, key, meta) => {
                        const endpoint = meta.device.getEndpoint(1);
                        await endpoint.read("manuSpecificLumi", [0x019a], {manufacturerCode: manufacturerCode});
                    }
                },
            ]
        },

        // OTA
        modernExtend.quirkCheckinInterval("1_HOUR"),
        lumi.lumiModernExtend.lumiZigbeeOTA()
    ]
};
