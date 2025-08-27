export async function resolveAddressPhase(agent, documentResults, assessment) {
  const allAddresses = [...documentResults.addresses];
  if (documentResults.extractedData.addresses) allAddresses.push(...documentResults.extractedData.addresses);
  if (allAddresses.length === 0) {
    agent.addTimelineEvent(assessment, 'address_extraction', 'No address-like strings found; continuing without resolved site address');
    return { addresses: [], primaryAddress: null, hasValidAddress: false };
  }
  agent.addTimelineEvent(assessment, 'address_extraction', `Found ${allAddresses.length} potential addresses`);
  const addressResult = await agent.addressExtractor.extractAddresses(allAddresses.join(' '));
  if (!addressResult.hasValidAddress) {
    agent.addTimelineEvent(assessment, 'address_resolution_warning', 'No high-confidence address resolved; downstream spatial analysis may be limited');
    return addressResult;
  }
  agent.addTimelineEvent(assessment, 'address_resolved', `Resolved address: ${addressResult.primaryAddress.formattedAddress || addressResult.primaryAddress.cleaned}`);
  return addressResult;
}
