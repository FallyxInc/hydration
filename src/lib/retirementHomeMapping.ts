// Retirement home name mapping to URL-safe identifiers
export const retirementHomeMapping: Record<string, string> = {
  'Cedar Grove': 'cedar-grove',
  'Responsive Senior Living': 'responsive-senior-living',
  'Eatonville': 'eatonville',
  'Hawthorne': 'hawthorne',
  'Sprucedale': 'sprucedale'
};

// Function to get URL-safe identifier for retirement home
export function getHomeIdentifier(displayName: string): string {
  const identifier = retirementHomeMapping[displayName];
  if (identifier) {
    console.log(`🏠 [MAPPING] Mapped "${displayName}" to "${identifier}"`);
    return identifier;
  }
  
  // Fallback: convert to URL-safe format
  const fallback = displayName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  console.log(`🏠 [MAPPING] Fallback mapping "${displayName}" to "${fallback}"`);
  return fallback;
}
