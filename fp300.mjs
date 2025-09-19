import * as exposes from "zigbee-herdsman-converters/lib/exposes";
import * as lumi from "zigbee-herdsman-converters/lib/lumi";
import * as modernExtend from "zigbee-herdsman-converters/lib/modernExtend";

const e = exposes.presets;
const ea = exposes.access;

const {manufacturerCode} = lumi;
const manufacturerOptions = {
    lumi: {manufacturerCode: manufacturerCode, disableDefaultResponse: true},
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
        await endpoint.read("manuSpecificLumi", [0x00ee], {manufacturerCode: manufacturerCode}); // Read OTA data; makes the device expose more attributes related to OTA
        await endpoint.read("manuSpecificLumi", [0x010c], {manufacturerCode: manufacturerCode}); // Read motion sensitivity (change required in https://github.com/Koenkk/zigbee-herdsman-converters/blob/0755b15bf878f2261f17956efb12e52e91642cfa/src/lib/lumi.ts#L641 )
    },
    extend: [
        lumi.lumiModernExtend.fp1ePresence(), // Works
        modernExtend.illuminance(), // Works
        modernExtend.humidity(), // Works
        modernExtend.temperature(), // Works
        modernExtend.battery(),
        lumi.lumiModernExtend.fp1eSpatialLearning(),
        lumi.lumiModernExtend.lumiLedIndicator(), // Works?
        lumi.lumiModernExtend.fp1eRestartDevice(), // Works
        modernExtend.identify(), // Works

        // OTA
        modernExtend.quirkCheckinInterval("1_HOUR"),
        lumi.lumiModernExtend.lumiZigbeeOTA()
    ],
    meta: {},
};
