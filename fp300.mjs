import {Zcl} from "zigbee-herdsman";
import * as exposes from "zigbee-herdsman-converters/lib/exposes";
import * as lumi from "zigbee-herdsman-converters/lib/lumi";
import * as modernExtend from "zigbee-herdsman-converters/lib/modernExtend";

const e = exposes.presets;
const ea = exposes.access;

const {manufacturerCode} = lumi;

// Time encoding/decoding
const parseTime = (timeStr) => {
    if (typeof timeStr !== "string" || !timeStr.match(/^\d{1,2}:\d{1,2}$/)) {
        throw new Error(`Invalid time format: ${timeStr}. Expected HH:MM`);
    }
    
    const [hours, minutes] = timeStr.split(":").map((num) => Number.parseInt(num, 10));
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new Error(`Invalid time format: ${timeStr}`);
    }
    
    return {hours, minutes};
};
function encodeTimeFormat(startTime, endTime) {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    return start.hours | (start.minutes << 8) | (end.hours << 16) | (end.minutes << 24);
}

const formatTime = (hours, minutes) => `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
function decodeTimeFormat(value) {
    if (typeof value !== "number" || value < 0 || value > 0xffffffff) return null;

    const startHour = value & 0xff;
    const startMin = (value >> 8) & 0xff;
    const endHour = (value >> 16) & 0xff;
    const endMin = (value >> 24) & 0xff;

    if (startHour > 23 || startMin > 59 || endHour > 23 || endMin > 59) return null;

    return {
        startTime: formatTime(startHour, startMin),
        endTime: formatTime(endHour, endMin),
    };
}

function encodeDetectionRangeComposite(detection_range_value) {
    const composite_values = {};
    for (let i = 0; i < 24; ++i) {
        composite_values[`detection_range_${i}`] = ((detection_range_value >> i) & 1) == 1;
    }
    return composite_values;
}

function decodeDetectionRangeComposite(composite_values) {
    let intValue = 0;
    for (let i = 0; i < 24; ++i) {
        if (composite_values[`detection_range_${i}`]) intValue |= 1 << i;
    }
    return intValue;
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
                e
                    .numeric('detection_range', ea.ALL)
                    .withValueMin(0)
                    .withValueMax((1 << 24) - 1)
                    .withValueStep(1)
                    .withDescription("Specifies the range that is being detected. Requires mmWave radar mode. Press the on-device button to wake the device up and refresh its' settings."),
                e
                    .composite("detection_range_composite", "detection_range_composite", ea.ALL)
                    .withDescription("Specifies the detection range using set of boolean settings.")
                    .withFeature(e.binary("detection_range_0", ea.SET, true, false).withDescription("0.00m - 0.25m"))
                    .withFeature(e.binary("detection_range_1", ea.SET, true, false).withDescription("0.25m - 0.50m"))
                    .withFeature(e.binary("detection_range_2", ea.SET, true, false).withDescription("0.50m - 0.75m"))
                    .withFeature(e.binary("detection_range_3", ea.SET, true, false).withDescription("0.75m - 1.00m"))
                    .withFeature(e.binary("detection_range_4", ea.SET, true, false).withDescription("1.00m - 1.25m"))
                    .withFeature(e.binary("detection_range_5", ea.SET, true, false).withDescription("1.25m - 1.50m"))
                    .withFeature(e.binary("detection_range_6", ea.SET, true, false).withDescription("1.50m - 1.75m"))
                    .withFeature(e.binary("detection_range_7", ea.SET, true, false).withDescription("1.75m - 2.00m"))
                    .withFeature(e.binary("detection_range_8", ea.SET, true, false).withDescription("2.00m - 2.25m"))
                    .withFeature(e.binary("detection_range_9", ea.SET, true, false).withDescription("2.25m - 2.50m"))
                    .withFeature(e.binary("detection_range_10", ea.SET, true, false).withDescription("2.50m - 2.75m"))
                    .withFeature(e.binary("detection_range_11", ea.SET, true, false).withDescription("2.75m - 3.00m"))
                    .withFeature(e.binary("detection_range_12", ea.SET, true, false).withDescription("3.00m - 3.25m"))
                    .withFeature(e.binary("detection_range_13", ea.SET, true, false).withDescription("3.25m - 3.50m"))
                    .withFeature(e.binary("detection_range_14", ea.SET, true, false).withDescription("3.50m - 3.75m"))
                    .withFeature(e.binary("detection_range_15", ea.SET, true, false).withDescription("3.75m - 4.00m"))
                    .withFeature(e.binary("detection_range_16", ea.SET, true, false).withDescription("4.00m - 4.25m"))
                    .withFeature(e.binary("detection_range_17", ea.SET, true, false).withDescription("4.25m - 4.50m"))
                    .withFeature(e.binary("detection_range_18", ea.SET, true, false).withDescription("4.50m - 4.75m"))
                    .withFeature(e.binary("detection_range_19", ea.SET, true, false).withDescription("4.75m - 5.00m"))
                    .withFeature(e.binary("detection_range_20", ea.SET, true, false).withDescription("5.00m - 5.25m"))
                    .withFeature(e.binary("detection_range_21", ea.SET, true, false).withDescription("5.25m - 5.50m"))
                    .withFeature(e.binary("detection_range_22", ea.SET, true, false).withDescription("5.50m - 5.75m"))
                    .withFeature(e.binary("detection_range_23", ea.SET, true, false).withDescription("5.75m - 6.00m"))
            ],
            fromZigbee: [
                {
                    cluster: "manuSpecificLumi",
                    type: ["attributeReport", "readResponse"],
                    convert: async (model, msg, publish, options, meta) => {
                        if (msg.data["410"] && Buffer.isBuffer(msg.data["410"])) {
                            const buffer = msg.data["410"];
                            const detection_range_value = (buffer.length > 0) ? buffer.readUIntLE(2, 3) : 0xFFFFFF;

                            return {
                                detection_range_prefix: (buffer.length > 0) ? buffer.readUIntLE(0, 2) : 0x0300,
                                detection_range: detection_range_value,
                                detection_range_composite: encodeDetectionRangeComposite(detection_range_value)
                            };
                        }
                    },
                }
            ],
            toZigbee: [
                {
                    key: ["detection_range"],
                    convertSet: async (entity, key, value, meta) => {
                        const buffer = Buffer.allocUnsafe(5);
                        buffer.writeUIntLE(meta.state?.detection_range_prefix ?? 0x0300, 0, 2);
                        buffer.writeUIntLE(value, 2, 3);

                        await entity.write("manuSpecificLumi", {
                            410: {value: buffer, type: 0x41}
                        }, {manufacturerCode: manufacturerCode});
                        return {
                            state: {
                                detection_range: value,
                                detection_range_composite: encodeDetectionRangeComposite(value)
                            }
                        };
                    },
                    convertGet: async (entity, key, meta) => {
                        const endpoint = meta.device.getEndpoint(1);
                        await endpoint.read("manuSpecificLumi", [0x019a], {manufacturerCode: manufacturerCode});
                    }
                },
                {
                    key: ["detection_range_composite"],
                    convertSet: async (entity, key, value, meta) => {
                        const detection_range_value = decodeDetectionRangeComposite(value);
                        
                        const buffer = Buffer.allocUnsafe(5);
                        buffer.writeUIntLE(meta.state?.detection_range_prefix ?? 0x0300, 0, 2);
                        buffer.writeUIntLE(detection_range_value, 2, 3);

                        await entity.write("manuSpecificLumi", { 410: {value: buffer, type: 0x41} }, {manufacturerCode: manufacturerCode});
                        return {
                            state: {
                                detection_range: detection_range_value,
                                detection_range_composite: value
                            }
                        };
                    },
                    convertGet: async (entity, key, meta) => {
                        const endpoint = meta.device.getEndpoint(1);
                        await endpoint.read("manuSpecificLumi", [0x019a], {manufacturerCode: manufacturerCode});
                    }
                },
            ]
        },

        // LED Indicator
        lumi.lumiModernExtend.lumiLedDisabledNight(),
        {
            isModernExtend: true,
            exposes: [
                e
                    .text("schedule_start_time", ea.ALL)
                    .withDescription(
                        "LED disable schedule start time (HH:MM format)",
                    ),
                e
                    .text("schedule_end_time", ea.ALL)
                    .withDescription(
                        "LED disable schedule end time (HH:MM format)",
                    )
            ],
            fromZigbee: [
                {
                    cluster: "manuSpecificLumi",
                    type: ["attributeReport", "readResponse"],
                    convert: async (model, msg, publish, options, meta) => {
                        if (msg.data["574"] !== undefined) {
                            const rawValue = msg.data["574"];
                            const decoded = decodeTimeFormat(rawValue);

                            return {
                                schedule_start_time: decoded ? decoded.startTime : '--:--',
                                schedule_end_time: decoded ? decoded.endTime : '--:--',
                                schedule_time_raw: rawValue
                            }
                        }
                    },
                },
            ],
            toZigbee: [
                {
                    key: ["schedule_start_time", "schedule_end_time"],
                    convertSet: async (entity, key, value, meta) => {
                        // Validate input
                        const trimmedValue = value.trim();
                        if (!trimmedValue.match(/^\d{1,2}:\d{2}$/)) {
                            throw new Error(`Invalid ${key} format: "${value}". Expected HH:MM format (e.g., "21:30")`);
                        }
                        
                        // Read current and replace the attribute being edited
                        const newData = {
                            schedule_start_time: meta.state?.schedule_start_time ?? "00:00",
                            schedule_end_time: meta.state?.schedule_end_time ?? "00:00"
                        };
                        newData[key] = value;

                        // Encode and write
                        const encodedValue = encodeTimeFormat(newData.schedule_start_time, newData.schedule_end_time);
                        newData.schedule_time_raw = encodedValue;
                        await entity.write("manuSpecificLumi", { 574: { value: encodedValue, type: 0x0023 } }, {manufacturerCode: manufacturerCode});
                        
                        return { state: newData };
                    },
                    convertGet: async (entity, key, meta) => {
                        const endpoint = meta.device.getEndpoint(1);
                        await endpoint.read("manuSpecificLumi", [0x023e], {manufacturerCode: manufacturerCode});
                    },
                },
            ],
        },

        // OTA
        modernExtend.quirkCheckinInterval("1_HOUR"),
        lumi.lumiModernExtend.lumiZigbeeOTA()
    ]
};
