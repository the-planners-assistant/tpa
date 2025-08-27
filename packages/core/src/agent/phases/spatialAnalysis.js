export async function spatialAnalysisPhase(agent, coordinates, assessment) {
  agent.addTimelineEvent(assessment, 'spatial_analysis_start', 'Starting comprehensive spatial analysis');
  // Expect either GeoJSON Polygon/MultiPolygon or [lng,lat]. If only point, build small buffer square (approx 50m) as provisional site geometry.
  let geometry = coordinates;
  if (Array.isArray(coordinates) && coordinates.length === 2 && typeof coordinates[0] === 'number') {
    const [lng, lat] = coordinates;
    const delta = 0.00045; // ~50m at mid latitudes
    geometry = {
      type: 'Polygon',
      coordinates: [[
        [lng - delta, lat - delta],
        [lng + delta, lat - delta],
        [lng + delta, lat + delta],
        [lng - delta, lat + delta],
        [lng - delta, lat - delta]
      ]]
    };
    agent.addTimelineEvent(assessment, 'spatial_geometry_placeholder', 'Generated placeholder site polygon (approx 50m square) from point due to missing boundary');
  }
  const spatialResult = await agent.spatialAnalyzer.analyzeSite(geometry);
  // Normalize legacy keys for downstream consumers (intersections/siteMetrics/accessibilityAnalysis)
  const normalized = {
    ...spatialResult,
    siteGeometry: geometry,
    intersections: spatialResult.intersections || spatialResult.constraints?.intersecting || {},
    siteMetrics: spatialResult.metrics || spatialResult.siteMetrics || {},
    proximities: spatialResult.proximities?.details || spatialResult.proximities || {},
    accessibilityAnalysis: spatialResult.transport || spatialResult.accessibilityAnalysis || {}
  };
  agent.addTimelineEvent(assessment, 'spatial_analysis_complete', `Spatial analysis complete; constraints: ${Object.keys(normalized.intersections || {}).length}`);
  return normalized;
}
