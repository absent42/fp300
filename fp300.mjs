import * as exposes from "zigbee-herdsman-converters/lib/exposes";
import * as lumi from "zigbee-herdsman-converters/lib/lumi";
import * as modernExtend from "zigbee-herdsman-converters/lib/modernExtend";

const e = exposes.presets;
const ea = exposes.access;

const {manufacturerCode} = lumi;
const manufacturerOptions = {
    lumi: {manufacturerCode: manufacturerCode, disableDefaultResponse: true},
};

export const fp300 = {
    SpatialLearning: () => {
        return {
            isModernExtend: true,
            exposes: [e.enum("spatial_learning", ea.SET, ["Start Learning"]).withDescription("Initiate AI Spatial Learning.")],
            toZigbee: [
                {
                    key: ["spatial_learning"],
                    convertSet: async (entity, key, value, meta) => {
                        await entity.write("manuSpecificLumi", {343: {value: 1, type: 0x20}}, manufacturerOptions.lumi);
                    },
                },
            ],
        };
    },
};

export default {
    zigbeeModel: ["lumi.sensor_occupy.agl8"],
    model: "lumi.sensor_occupy.agl8",
    vendor: "Aqara",
    description: "FP300 Presence Sensor",
    fromZigbee: [lumi.fromZigbee.lumi_specific],
    toZigbee: [lumi.toZigbee.lumi_motion_sensitivity],
    exposes: [
        e.power_outage_count(), // Works
        e
            .motion_sensitivity_select(["low", "medium", "high"])
            .withDescription("Presence Detection Sensitivity."), // Works
    ],
    configure: async (device, coordinatorEndpoint) => {
        const endpoint = device.getEndpoint(1);
        await endpoint.read("manuSpecificLumi", [0x010c], {manufacturerCode: manufacturerCode});
    },
    extend: [
        lumi.lumiModernExtend.fp1ePresence(), // Works
        modernExtend.illuminance(), // Works
        modernExtend.humidity(), // Works
        modernExtend.temperature(), // Works
        modernExtend.battery(),
        fp300.SpatialLearning(),
        lumi.lumiModernExtend.lumiLedIndicator(), // Works?
        lumi.lumiModernExtend.fp1eRestartDevice(), // Works
        modernExtend.identify(), // Works
    ],
    meta: {},
};
