import { IntegrationRegistry } from "./shared/registry.js";
import { rtkGnssCapability } from "./communications/common/rtk-gnss.js";
import { gcsCapability } from "./communications/common/gcs.js";
import { networkTelemetryCapability } from "./communications/common/network-telemetry.js";
import { mobileRelayCapability } from "./communications/common/mobile-relay.js";
import { tvwsStationCapability } from "./communications/wildfire/tvws-station.js";
import { satelliteBackhaulCapability } from "./communications/wildfire/satellite-backhaul.js";
import { rssiScannerCapability } from "./communications/landslide/rssi-scanner.js";
import { emergencyTerminalCapability } from "./communications/landslide/emergency-terminal.js";
import { communicationCoverageCapability } from "./ai/common/communication-coverage.js";
import { relayPlacementCapability } from "./ai/common/relay-placement.js";
import { firelineDetectionCapability } from "./ai/wildfire/fireline-detection.js";
import { wildfireSpreadCapability } from "./ai/wildfire/spread-prediction.js";
import { landslideRiskCapability } from "./ai/landslide/risk-assessment.js";
import { debrisFlowCapability } from "./ai/landslide/debris-flow.js";
import { victimLocalizationCapability } from "./ai/landslide/victim-localization.js";
import { rtkBaseLpwaGatewayCapability } from "./communications/wildfire/rtk-base-lpwa-gateway.js";
import { radioGatewayCapability } from "./communications/wildfire/radio-gateway.js";
import { mainRelayDroneCapability } from "./communications/landslide/main-relay-drone.js";
import { serviceRelayDroneCapability } from "./communications/landslide/service-relay-drone.js";
import { fixedRelayCapability } from "./communications/landslide/fixed-relay.js";
import { irUwbGprCapability } from "./communications/landslide/ir-uwb-gpr.js";
import { aiRanCapability } from "./ai/wildfire/ai-ran.js";
import { vehicleRoadAnalysisCapability } from "./ai/wildfire/vehicle-road-analysis.js";
import { changeDetectionCapability } from "./ai/landslide/change-detection.js";
import { vitalSignalAnalysisCapability } from "./ai/landslide/vital-signal-analysis.js";
import { attenuationCorrectionCapability } from "./ai/landslide/attenuation-correction.js";

export const integrationRegistry = new IntegrationRegistry().register(
  rtkGnssCapability,
  gcsCapability,
  networkTelemetryCapability,
  mobileRelayCapability,
  tvwsStationCapability,
  satelliteBackhaulCapability,
  rssiScannerCapability,
  emergencyTerminalCapability,
  communicationCoverageCapability,
  relayPlacementCapability,
  firelineDetectionCapability,
  wildfireSpreadCapability,
  landslideRiskCapability,
  debrisFlowCapability,
  victimLocalizationCapability,
  rtkBaseLpwaGatewayCapability,
  radioGatewayCapability,
  mainRelayDroneCapability,
  serviceRelayDroneCapability,
  fixedRelayCapability,
  irUwbGprCapability,
  aiRanCapability,
  vehicleRoadAnalysisCapability,
  changeDetectionCapability,
  vitalSignalAnalysisCapability,
  attenuationCorrectionCapability,
);
