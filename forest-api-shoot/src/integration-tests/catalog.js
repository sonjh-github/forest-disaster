import rtkGnss from "./communications/common/rtk-gnss.js";
import gcs from "./communications/common/gcs.js";
import networkTelemetry from "./communications/common/network-telemetry.js";
import mobileRelay from "./communications/common/mobile-relay.js";
import tvwsStation from "./communications/wildfire/tvws-station.js";
import satelliteBackhaul from "./communications/wildfire/satellite-backhaul.js";
import rssiScanner from "./communications/landslide/rssi-scanner.js";
import emergencyTerminal from "./communications/landslide/emergency-terminal.js";
import communicationCoverage from "./ai/common/communication-coverage.js";
import relayPlacement from "./ai/common/relay-placement.js";
import firelineDetection from "./ai/wildfire/fireline-detection.js";
import wildfireSpread from "./ai/wildfire/spread-prediction.js";
import landslideRisk from "./ai/landslide/risk-assessment.js";
import debrisFlow from "./ai/landslide/debris-flow.js";
import victimLocalization from "./ai/landslide/victim-localization.js";
import rtkBaseLpwaGateway from "./communications/wildfire/rtk-base-lpwa-gateway.js";
import radioGateway from "./communications/wildfire/radio-gateway.js";
import mainRelayDrone from "./communications/landslide/main-relay-drone.js";
import serviceRelayDrone from "./communications/landslide/service-relay-drone.js";
import fixedRelay from "./communications/landslide/fixed-relay.js";
import irUwbGpr from "./communications/landslide/ir-uwb-gpr.js";
import aiRan from "./ai/wildfire/ai-ran.js";
import vehicleRoadAnalysis from "./ai/wildfire/vehicle-road-analysis.js";
import changeDetection from "./ai/landslide/change-detection.js";
import vitalSignalAnalysis from "./ai/landslide/vital-signal-analysis.js";
import attenuationCorrection from "./ai/landslide/attenuation-correction.js";

export const integrationTests = [
  rtkGnss, gcs, networkTelemetry, mobileRelay, tvwsStation, satelliteBackhaul,
  rssiScanner, emergencyTerminal, communicationCoverage, relayPlacement,
  firelineDetection, wildfireSpread, landslideRisk, debrisFlow, victimLocalization,
  rtkBaseLpwaGateway, radioGateway, mainRelayDrone, serviceRelayDrone, fixedRelay,
  irUwbGpr, aiRan, vehicleRoadAnalysis, changeDetection, vitalSignalAnalysis,
  attenuationCorrection,
];

export function findIntegrationTest(id) {
  return integrationTests.find((test) => test.id === id);
}
