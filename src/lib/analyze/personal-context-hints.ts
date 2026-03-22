/**
 * Contract-type-aware helper copy for the optional personal context field on Analyze.
 * Keep wording plain; avoid em/en dashes in user-facing strings.
 */

const GENERIC_HINT_LINES = [
  "who the agreement covers (you, family, housemates, or your business)",
  "how you actually use the product, property, or vehicle",
  "anything unusual (high value items, travel plans, or working from home)",
  "past claims, complaints, or disputes that might matter",
  "deadlines or life changes that could affect the agreement",
  "anything else that could affect costs, cover, or how you exit",
] as const;

const HEALTH_HINT_LINES = [
  "regular medications or ongoing treatment",
  "children or other dependants",
  "specialist doctors or facilities you rely on",
  "travel across states or abroad",
  "sports, hobbies, or higher risk activities",
  "pregnancy or family planning",
  "anything else that could affect your coverage or costs",
] as const;

const HOME_HINT_LINES = [
  "an older or listed building",
  "a flat roof, single glazing, or non standard construction",
  "bikes in a shed, valuables, or jewellery above typical limits",
  "working from home or running a business from the property",
  "outbuildings, garages, or shared access",
  "tenants, lodgers, or shared ownership",
  "flood, storm, or subsidence concerns in your area",
  "anything else insurers often ask about for home cover",
] as const;

const CAR_HINT_LINES = [
  "commuting versus business or commercial use",
  "named drivers, young drivers, or learners",
  "modifications or non standard equipment",
  "where the car is kept overnight",
  "annual mileage or long trips",
  "delivery, courier, or rideshare use",
  "previous claims or convictions",
  "anything else that could change your premium or cover",
] as const;

const TRAVEL_HINT_LINES = [
  "pre existing conditions or recent treatment",
  "winter sports, adventure activities, or cruises",
  "trip length or multi region travel",
  "valuables, gadgets, or cash you carry",
  "rental cars or driving abroad",
  "non UK or non US home country if relevant",
  "anything else that could affect medical or cancellation cover",
] as const;

export function getPersonalContextHintLines(
  contractTypeChoice: string,
): readonly string[] {
  switch (contractTypeChoice) {
    case "Health insurance":
      return HEALTH_HINT_LINES;
    case "Home insurance":
      return HOME_HINT_LINES;
    case "Car insurance":
      return CAR_HINT_LINES;
    case "Travel insurance":
      return TRAVEL_HINT_LINES;
    default:
      return GENERIC_HINT_LINES;
  }
}

const PLACEHOLDER_GENERIC =
  "e.g., Who is covered, how you use the service or property, any high value items, travel plans, or past claims. Short notes are fine.";

const PLACEHOLDER_HEALTH =
  "e.g., I take daily medication, have two dependants, and see a specialist twice a year. We travel abroad once a year and I play weekend rugby.";

const PLACEHOLDER_HOME =
  "e.g., Listed Victorian house, partial flat roof, jewellery kept at home, home office 3 days a week, small outbuilding, no flood claims but near a river.";

const PLACEHOLDER_CAR =
  "e.g., Social and commuting, two named drivers including a learner, car on the driveway overnight, about 8,000 miles a year, no modifications, one claim two years ago.";

const PLACEHOLDER_TRAVEL =
  "e.g., Two week trip to the US, mild asthma, planning ski days, carrying a laptop and camera, need cover for delayed bags and medical costs.";

export function getPersonalContextPlaceholder(
  contractTypeChoice: string,
): string {
  switch (contractTypeChoice) {
    case "Health insurance":
      return PLACEHOLDER_HEALTH;
    case "Home insurance":
      return PLACEHOLDER_HOME;
    case "Car insurance":
      return PLACEHOLDER_CAR;
    case "Travel insurance":
      return PLACEHOLDER_TRAVEL;
    default:
      return PLACEHOLDER_GENERIC;
  }
}
