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
    Presence: () => {
        const attribute = {ID: 0x0142, type: 0x20};
        return modernExtend.binary({
            name: "presence",
            valueOn: [true, 1],
            valueOff: [false, 0],
            access: "STATE_GET",
            cluster: "manuSpecificLumi",
            attribute: attribute,
            description: "Indicates whether the device detected presence",
        });
    },
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
    RestartDevice: () => {
        return {
            isModernExtend: true,
            exposes: [e.enum("restart_device", ea.SET, ["Restart Device"]).withDescription("Restarts the device.")],
            toZigbee: [
                {
                    key: ["restart_device"],
                    convertSet: async (entity, key, value, meta) => {
                        await entity.write("manuSpecificLumi", {232: {value: 0x00, type: 0x10}}, manufacturerOptions.lumi);
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
    toZigbee: [lumi.toZigbee.lumi_presence, lumi.toZigbee.lumi_motion_sensitivity],
    exposes: [
        e.power_outage_count(), // Works
        e
            .motion_sensitivity_select(["low", "medium", "high"])
            .withDescription("Presence Detection Sensitivity."), // Works?
    ],
    configure: async (device, coordinatorEndpoint) => {
        // Retrieve motion sensitivity value
        const endpoint = device.getEndpoint(1);
        await endpoint.read("manuSpecificLumi", [0x010c], {manufacturerCode: manufacturerCode});
    },
    extend: [
        fp300.Presence(), // Works
        modernExtend.illuminance(),
        modernExtend.humidity(),
        modernExtend.temperature(),
        modernExtend.battery(),
        fp300.SpatialLearning(),
        fp300.RestartDevice(), // Works
        modernExtend.identify(), // Works
    ],
    meta: {},
};
