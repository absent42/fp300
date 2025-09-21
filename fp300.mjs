import {Zcl} from "zigbee-herdsman";
import * as exposes from "zigbee-herdsman-converters/lib/exposes";
import * as lumi from "zigbee-herdsman-converters/lib/lumi";
import * as modernExtend from "zigbee-herdsman-converters/lib/modernExtend";

const e = exposes.presets;
const ea = exposes.access;

const {manufacturerCode} = lumi;

// Time encoding/decoding
function encodeTimeFormat(startTime, endTime) {
    const parseTime = (timeStr) => {
        if (typeof timeStr !== "string" || !timeStr.match(/^\d{1,2}:\d{2}$/)) {
            throw new Error(`Invalid time format: ${timeStr}. Expected HH:MM`);
        }
        const [hours, minutes] = timeStr.split(":").map((num) => Number.parseInt(num, 10));
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            throw new Error(`Invalid time format: ${timeStr}`);
        }
        return {hours, minutes};
    };

    const start = parseTime(startTime);
    const end = parseTime(endTime);
    const value = start.hours | (start.minutes << 8) | (end.hours << 16) | (end.minutes << 24);

    return value >>> 0;
}

function decodeTimeFormat(value) {
    if (typeof value !== "number" || value < 0 || value > 0xffffffff) {
        return null;
    }

    const startHour = value & 0xff;
    const startMin = (value >> 8) & 0xff;
    const endHour = (value >> 16) & 0xff;
    const endMin = (value >> 24) & 0xff;

    if (startHour > 23 || startMin > 59 || endHour > 23 || endMin > 59) {
        return null;
    }

    const formatTime = (hours, minutes) => {
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    };

    return {
        startTime: formatTime(startHour, startMin),
        endTime: formatTime(endHour, endMin),
    };
}

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
        lumi.lumiModernExtend.fp1eSpatialLearning(), // Works
        lumi.lumiModernExtend.fp1eRestartDevice(), // Works
        modernExtend.identify(), // Works

        // Sampling parameters
        modernExtend.enumLookup({
            name: "temp_&_humidity_sampling",
            lookup: {off: 0, low: 1, medium: 2, high: 3, custom: 4},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0170, type: Zcl.DataType.UINT8}, // Attribute: 368
            description: "Sampling time frequency, increasing affects battery life. Setting to custom allows specifying period, interval & threshold.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "temp_&_humidity_sampling_period",
            valueMin: 0.5, // Min: 500ms
            valueMax: 3600, // Max: 1h = 3600s
            valueStep: 0.5, // Step: 500ms
            scale: 1000,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0162, type: Zcl.DataType.UINT32}, // Attribute: 354
            description: "How often temp & humidity readings are taken on the device when in custom mode.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        
        // Temperature
        modernExtend.numeric({
            name: "temp_reporting_interval",
            valueMin: 600, // Min: 10min = 600s
            valueMax: 3600, // Max: 1h = 3600s
            valueStep: 600, // Step: 10min = 600s
            scale: 1000,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0163, type: Zcl.DataType.UINT32}, // Attribute: 355
            description: "Custom time interval for temperature data reporting.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "temp_reporting_threshold",
            valueMin: 0.2, // Min: 0,2 C
            valueMax: 3, // Max: 3,0 C
            valueStep: 0.1, // Step: 0,1 C
            scale: 100,
            unit: "°C",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0164, type: Zcl.DataType.UINT16}, // Attribute: 356
            description: "Reporting will trigger as temperature change reaches this value when in custom mode.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.enumLookup({
            name: "temp_reporting_mode",
            lookup: {threshold: 1, "reporting interval": 2, "threshold and interval": 3},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0165, type: Zcl.DataType.UINT8}, // Attribute: 357
            description: "Temperature reporting type when in custom mode.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        
        // Humidity
        modernExtend.numeric({
            name: "humidity_reporting_interval",
            valueMin: 600, // Min: 10min = 600s
            valueMax: 3600, // Max: 1h = 3600s
            valueStep: 600, // Step: 10min = 600s
            scale: 1000,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x016a, type: Zcl.DataType.UINT32}, // Attribute: 362
            description: "Custom time interval for humidity data reporting.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "humidity_reporting_threshold",
            valueMin: 2, // Min: 2%
            valueMax: 10, // Max: 10%
            valueStep: 0.5, // Step: 0,5%
            scale: 100,
            unit: "%",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x016b, type: Zcl.DataType.UINT16}, // Attribute: 363
            description: "Reporting will trigger as humidity change reaches this value when in custom mode.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.enumLookup({
            name: "humidity_report_mode",
            lookup: {threshold: 1, "reporting interval": 2, "threshold and interval": 3},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x016c, type: Zcl.DataType.UINT8}, // Attribute: 364
            description: "Humidity reporting type when in custom mode.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        // Illuminance (Offsets seem to match temperature & humidity)
        modernExtend.enumLookup({ // CONFIRMED
            name: "light_sampling",
            lookup: {off: 0, low: 1, medium: 2, high: 3, custom: 4},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0192, type: Zcl.DataType.UINT8}, // Attribute: 402
            description: "Sampling time frequency, increasing affects battery life. Setting to custom allows specifying period, interval & threshold.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "light_sampling_period",
            valueMin: 0.5, // Min: 500ms
            valueMax: 3600, // Max: 1h = 3600s 
            valueStep: 0.5, // Step: 500ms
            scale: 1000,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0193, type: Zcl.DataType.UINT32}, // Attribute: 403
            description: "How often illumination readings are taken on the device when in custom mode.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "light_reporting_interval",
            valueMin: 20, // Min: 20s
            valueMax: 3600, // Max: 1h = 3600s
            valueStep: 20, // Step: 20s
            scale: 1000,
            unit: "sec",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0194, type: Zcl.DataType.UINT32}, // attribute 404
            description: "Custom interval for illumination data reporting.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.numeric({
            name: "light__reporting_threshold",
            valueMin: 3, // Min: 3%
            valueMax: 20, /// Max: 20%
            valueStep: 0.5, // Step: 0,5%
            scale: 100,
            unit: "%",
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0195, type: Zcl.DataType.UINT16}, // Attribute: 405
            description: "Reporting will trigger as illumination percentage change reaches this value when in custom mode.",
            zigbeeCommandOptions: {manufacturerCode},
        }),
        modernExtend.enumLookup({
            name: "light_report_mode",
            lookup: {threshold: 1, "reporting interval": 2, "threshold and interval": 3},
            cluster: "manuSpecificLumi",
            attribute: {ID: 0x0196, type: Zcl.DataType.UINT8}, // Attribute: 406
            description: "illumination reporting type when in custom mode.",
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
                    .withDescription("Specifies the range that is being detected. Requires mmWave radar mode. Press the on-device button to wake the device up and refresh its' settings."),
                e
                    .composite("detection_range_composite", "detection_range_composite", ea.ALL)
                    .withDescription("Specifies the range that is being detected. Requires mmWave radar mode. Press the on-device button to wake the device up and refresh its' settings.")
                    .withFeature(e.binary("range_0", ea.STATE_SET, true, false).withDescription("Range 0.00m - 0.25m"))
                    .withFeature(e.binary("range_1", ea.STATE_SET, true, false).withDescription("Range 0.25m - 0.50m"))
                    .withFeature(e.binary("range_2", ea.STATE_SET, true, false).withDescription("Range 0.50m - 0.75m"))
                    .withFeature(e.binary("range_3", ea.STATE_SET, true, false).withDescription("Range 0.75m - 1.00m"))
                    .withFeature(e.binary("range_4", ea.STATE_SET, true, false).withDescription("Range 1.00m - 1.25m"))
                    .withFeature(e.binary("range_5", ea.STATE_SET, true, false).withDescription("Range 1.25m - 1.50m"))
                    .withFeature(e.binary("range_6", ea.STATE_SET, true, false).withDescription("Range 1.50m - 1.75m"))
                    .withFeature(e.binary("range_7", ea.STATE_SET, true, false).withDescription("Range 1.75m - 2.00m"))
                    .withFeature(e.binary("range_8", ea.STATE_SET, true, false).withDescription("Range 2.00m - 2.25m"))
                    .withFeature(e.binary("range_9", ea.STATE_SET, true, false).withDescription("Range 2.25m - 2.50m"))
                    .withFeature(e.binary("range_10", ea.STATE_SET, true, false).withDescription("Range 2.50m - 2.75m"))
                    .withFeature(e.binary("range_11", ea.STATE_SET, true, false).withDescription("Range 2.75m - 3.00m"))
                    .withFeature(e.binary("range_12", ea.STATE_SET, true, false).withDescription("Range 3.00m - 3.25m"))
                    .withFeature(e.binary("range_13", ea.STATE_SET, true, false).withDescription("Range 3.25m - 3.50m"))
                    .withFeature(e.binary("range_14", ea.STATE_SET, true, false).withDescription("Range 3.50m - 3.75m"))
                    .withFeature(e.binary("range_15", ea.STATE_SET, true, false).withDescription("Range 3.75m - 4.00m"))
                    .withFeature(e.binary("range_16", ea.STATE_SET, true, false).withDescription("Range 4.00m - 4.25m"))
                    .withFeature(e.binary("range_17", ea.STATE_SET, true, false).withDescription("Range 4.25m - 4.50m"))
                    .withFeature(e.binary("range_18", ea.STATE_SET, true, false).withDescription("Range 4.50m - 4.75m"))
                    .withFeature(e.binary("range_19", ea.STATE_SET, true, false).withDescription("Range 4.75m - 5.00m"))
                    .withFeature(e.binary("range_20", ea.STATE_SET, true, false).withDescription("Range 5.00m - 5.25m"))
                    .withFeature(e.binary("range_21", ea.STATE_SET, true, false).withDescription("Range 5.25m - 5.50m"))
                    .withFeature(e.binary("range_22", ea.STATE_SET, true, false).withDescription("Range 5.50m - 5.75m"))
                    .withFeature(e.binary("range_23", ea.STATE_SET, true, false).withDescription("Range 5.75m - 6.00m"))
            ],
            fromZigbee: [
                {
                    cluster: "manuSpecificLumi",
                    type: ["attributeReport", "readResponse"],
                    convert: async (model, msg, publish, options, meta) => {
                        if (msg.data["410"] && Buffer.isBuffer(msg.data["410"])) {
                            const buffer = msg.data["410"]
                            return {
                                detection_range_prefix: (buffer.length > 0) ? buffer.readUIntLE(0, 2) : 0x0300,
                                detection_range: (buffer.length > 0) ? buffer.readUIntLE(2, 3) : 0xFFFFFF
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

        // LED Indicator
        lumi.lumiModernExtend.lumiLedIndicator(),
        {
            isModernExtend: true,
            exposes: [
                e
                    .text("schedule_start_time", ea.ALL)
                    .withDescription(
                        "LED off schedule start time (HH:MM format)",
                    ),
                e
                    .text("schedule_end_time", ea.ALL)
                    .withDescription(
                        "LED off schedule end time (HH:MM format)",
                    ),
                e
                    .composite("schedule_start_time_composite", "schedule_start_time_composite", ea.ALL)
                    .withDescription("LED off schedule end time (HH:MM format)")
                    .withFeature(e.enum("schedule_start_time_hour", ea.STATE_SET, ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23"]).withDescription("Hour"))
                    .withFeature(e.enum("schedule_start_time_minue", ea.STATE_SET, ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "51", "52", "53", "54", "55", "56", "57", "58", "59"]).withDescription("Minute")),
                e
                    .composite("schedule_end_time_composite", "schedule_end_time_composite", ea.ALL)
                    .withDescription("LED on schedule end time (HH:MM format)")
                    .withFeature(
                        e
                            .numeric("schedule_end_time_hour", ea.SET)
                            .withValueMin(0)
                            .withValueMax(23)
                            .withValueStep(1)
                    )
                    .withFeature(
                        e
                            .numeric("schedule_end_time_minute", ea.SET)
                            .withValueMin(0)
                            .withValueMax(59)
                            .withValueStep(1)
                    )
            ],
            fromZigbee: [
                {
                    cluster: "manuSpecificLumi",
                    type: ["attributeReport", "readResponse"],
                    convert: async (model, msg, publish, options, meta) => {
                        if (msg.data[574] !== undefined) {
                            const rawValue = msg.data[574];
                            const decoded = decodeTimeFormat(rawValue);
                            
                            if (decoded) {
                                return {
                                    schedule_start_time: decoded.startTime,
                                    schedule_end_time: decoded.endTime,
                                    schedule_time_raw: rawValue,
                                };
                            }
                            
                            return {
                                schedule_start_time: "--:--",
                                schedule_end_time: "--:--",
                                schedule_time_raw: rawValue,
                            };
                        }
                    },
                },
            ],
            toZigbee: [
                {
                    key: ["schedule_start_time", "schedule_end_time"],
                    convertSet: async (entity, key, value, meta) => {
                        // Validate input
                        if (!value || typeof value !== "string" || value.trim() === "") {
                            throw new Error(`${key} cannot be empty. Please provide time in HH:MM format (e.g., "21:30")`);
                        }
                        
                        const trimmedValue = value.trim();
                        if (!trimmedValue.match(/^\d{1,2}:\d{2}$/)) {
                            throw new Error(`Invalid ${key} format: "${value}". Expected HH:MM format (e.g., "21:30")`);
                        }
                        
                        // Read current value to get the other time component
                        const currentData = await entity.read("manuSpecificLumi", [574], {manufacturerCode: manufacturerCode});
                        const currentValue = currentData[574] || 0;
                        const currentDecoded = decodeTimeFormat(currentValue);
                        
                        let currentStart = "00:00";
                        let currentEnd = "00:00";
                        
                        if (currentDecoded) {
                            currentStart = currentDecoded.startTime;
                            currentEnd = currentDecoded.endTime;
                        }
                        
                        // Update time component
                        const newStart = key === "schedule_start_time" ? trimmedValue : currentStart;
                        const newEnd = key === "schedule_end_time" ? trimmedValue : currentEnd;
                        
                        // Encode and write
                        const encodedValue = encodeTimeFormat(newStart, newEnd);
                        
                        await entity.write(
                            "manuSpecificLumi",
                            {
                                574: {value: encodedValue, type: 35},
                            },
                            {manufacturerCode: manufacturerCode},
                        );
                        
                        const decoded = decodeTimeFormat(encodedValue);
                        return {
                            state: {
                                schedule_start_time: decoded ? decoded.startTime : newStart,
                                schedule_end_time: decoded ? decoded.endTime : newEnd,
                                schedule_time_raw: encodedValue,
                            },
                        };
                    },
                    convertGet: async (entity, key, meta) => {
                        const endpoint = meta.device.getEndpoint(1);
                        await endpoint.read("manuSpecificLumi", [574], {manufacturerCode: manufacturerCode});
                    },
                },
            ],
        },

        // OTA
        modernExtend.quirkCheckinInterval("1_HOUR"),
        lumi.lumiModernExtend.lumiZigbeeOTA()
    ]
};
